/**
 * WILLShop OS — Finance Engine Application Services
 * Application Layer.
 * 
 * Manages financial transactions, expenses, transfers, owner draws/contributions,
 * account reconciliations, and business obligations while strictly isolating tenant context.
 */

import { IFinanceRepository } from '../../domain/interfaces/IDataCoreRepositories';
import { IEventRepository } from '../../domain/interfaces/IRepositories';
import {
  FinancialAccountEntity,
  FinancialTransactionEntity,
  FinancialCategory,
  FinancialAccountType,
  FinancialObligationEntity,
  ObligationType,
  ObligationPartyType,
  FinanceSummaryMetrics,
} from '../../domain/entities/FinanceEntities';
import { FinanceInvariants } from '../../domain/services/FinanceInvariants';
import { getOrganizationContext, verifyPermission } from './OrganizationContextService';
import { AuditService } from './AuditService';
import { IdempotencyService } from './IdempotencyService';
import { ValidationError, NotFoundError } from '../../domain/errors/AppErrors';

export class CreateFinancialAccountService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly eventRepo: IEventRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  async execute(
    name: string,
    type: FinancialAccountType,
    openingBalance: number = 0,
    description?: string,
    idempotencyKey?: string
  ): Promise<FinancialAccountEntity> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    if (idempotencyKey) {
      const cached = await this.idempotencyService.check<FinancialAccountEntity>(
        idempotencyKey,
        ctx.organizationId,
        { name, type, openingBalance }
      );
      if (cached) return cached;
    }

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Financial account name is required.');
    }
    if (openingBalance < 0) {
      throw new ValidationError('Opening balance cannot be negative.');
    }

    // AUDIT FIX: Read currency from organization settings or env var instead of hardcoded 'XOF'
    // This enables multi-currency support when organization.settings.currency is populated
    const currency = (ctx as any).organization?.settings?.currency
      || process.env.NEXT_PUBLIC_DEFAULT_CURRENCY
      || 'XOF';

    const created = await this.financeRepo.createAccount({
      organizationId: ctx.organizationId,
      name,
      type: type as any,
      currency,
      openingBalance,
      status: 'ACTIVE',
    });

    const entity: FinancialAccountEntity = {
      id: created.id,
      organizationId: created.organizationId,
      name: created.name,
      type: created.type as any,
      currency: created.currency,
      openingBalance: created.openingBalance,
      currentBalance: (created as any).currentBalance ?? created.openingBalance,
      status: created.status as any,
      description,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'FINANCIAL_ACCOUNT_CREATED',
      targetEntity: 'financial_account',
      targetId: entity.id,
      afterState: { name, type, openingBalance },
    });

    await this.eventRepo.recordEvent({
      organizationId: ctx.organizationId,
      eventType: 'finance.account_created',
      payload: { accountId: entity.id, name, type },
    });

    if (idempotencyKey) {
      await this.idempotencyService.save(idempotencyKey, ctx.organizationId, { name, type, openingBalance }, entity);
    }

    return entity;
  }
}

export class CreateExpenseService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly eventRepo: IEventRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  async execute(
    financialAccountId: string,
    category: FinancialCategory,
    amount: number,
    description: string,
    receiptUrl?: string,
    supplierId?: string,
    idempotencyKey?: string
  ): Promise<FinancialTransactionEntity> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    if (idempotencyKey) {
      const cached = await this.idempotencyService.check<FinancialTransactionEntity>(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, category, amount, description }
      );
      if (cached) return cached;
    }

    if (amount <= 0) {
      throw new ValidationError('Expense amount must be greater than 0.');
    }

    const account = await this.financeRepo.getAccount(financialAccountId, ctx.organizationId);
    if (!account) {
      throw new NotFoundError(`Financial account with ID ${financialAccountId} not found.`);
    }

    const direction = FinanceInvariants.getDirectionForCategory(category);
    if (direction !== 'OUTFLOW') {
      throw new ValidationError(`Category ${category} is an inflow category, not an expense.`);
    }

    const recorded = await this.financeRepo.recordTransaction({
      organizationId: ctx.organizationId,
      financialAccountId,
      type: 'EXPENSE',
      amount,
      currency: 'XOF',
      category,
      referenceType: supplierId ? 'supplier_bill' : 'expense',
      referenceId: supplierId || null,
      description,
      transactionDate: new Date(),
      createdBy: ctx.userId,
    });

    const currentBalance = (account as any).currentBalance ?? account.openingBalance;
    const newBalance = currentBalance - amount;
    await this.financeRepo.updateAccountBalance(account.id, ctx.organizationId, newBalance);

    const txEntity: FinancialTransactionEntity = {
      id: recorded.id,
      organizationId: recorded.organizationId,
      financialAccountId: recorded.financialAccountId,
      type: recorded.type,
      direction: 'OUTFLOW',
      amount: recorded.amount,
      currency: recorded.currency,
      category: recorded.category as FinancialCategory,
      status: 'POSTED',
      referenceType: recorded.referenceType as any,
      referenceId: recorded.referenceId,
      receiptUrl,
      description: recorded.description,
      transactionDate: recorded.transactionDate,
      createdBy: recorded.createdBy,
      createdAt: recorded.createdAt,
      updatedAt: new Date(),
    };

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'EXPENSE_RECORDED',
      targetEntity: 'transaction',
      targetId: txEntity.id,
      afterState: { accountId: financialAccountId, category, amount, description, receiptUrl },
    });

    await this.eventRepo.recordEvent({
      organizationId: ctx.organizationId,
      eventType: 'finance.expense_created',
      payload: { transactionId: txEntity.id, accountId: financialAccountId, amount, category },
    });

    if (idempotencyKey) {
      await this.idempotencyService.save(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, category, amount, description },
        txEntity
      );
    }

    return txEntity;
  }
}

export class TransferFundsService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly eventRepo: IEventRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  async execute(
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    description: string = 'Inter-account fund transfer',
    idempotencyKey?: string
  ): Promise<{ sourceTransaction: FinancialTransactionEntity; destinationTransaction: FinancialTransactionEntity }> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    FinanceInvariants.validateTransfer(sourceAccountId, destinationAccountId, amount);

    if (idempotencyKey) {
      const cached = await this.idempotencyService.check<any>(
        idempotencyKey,
        ctx.organizationId,
        { sourceAccountId, destinationAccountId, amount }
      );
      if (cached) return cached;
    }

    const sourceAcc = await this.financeRepo.getAccount(sourceAccountId, ctx.organizationId);
    if (!sourceAcc) throw new NotFoundError(`Source account ${sourceAccountId} not found.`);

    const destAcc = await this.financeRepo.getAccount(destinationAccountId, ctx.organizationId);
    if (!destAcc) throw new NotFoundError(`Destination account ${destinationAccountId} not found.`);

    const transferId = `trf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const sourceTx = await this.financeRepo.recordTransaction({
      organizationId: ctx.organizationId,
      financialAccountId: sourceAccountId,
      type: 'TRANSFER',
      amount,
      currency: 'XOF',
      category: 'OTHER',
      referenceType: 'transfer',
      referenceId: transferId,
      description: `[Transfer Out to ${destAcc.name}] ${description}`,
      transactionDate: new Date(),
      createdBy: ctx.userId,
    });

    const sourceCurrent = (sourceAcc as any).currentBalance ?? sourceAcc.openingBalance;
    await this.financeRepo.updateAccountBalance(sourceAccountId, ctx.organizationId, sourceCurrent - amount);

    const destTx = await this.financeRepo.recordTransaction({
      organizationId: ctx.organizationId,
      financialAccountId: destinationAccountId,
      type: 'TRANSFER',
      amount,
      currency: 'XOF',
      category: 'OTHER',
      referenceType: 'transfer',
      referenceId: transferId,
      description: `[Transfer In from ${sourceAcc.name}] ${description}`,
      transactionDate: new Date(),
      createdBy: ctx.userId,
    });

    const destCurrent = (destAcc as any).currentBalance ?? destAcc.openingBalance;
    await this.financeRepo.updateAccountBalance(destinationAccountId, ctx.organizationId, destCurrent + amount);

    const sourceEntity: FinancialTransactionEntity = {
      id: sourceTx.id,
      organizationId: sourceTx.organizationId,
      financialAccountId: sourceAccountId,
      type: 'TRANSFER',
      direction: 'OUTFLOW',
      amount,
      currency: 'XOF',
      category: 'OTHER',
      status: 'POSTED',
      transferId,
      referenceType: 'transfer',
      referenceId: transferId,
      description: sourceTx.description,
      transactionDate: sourceTx.transactionDate,
      createdBy: ctx.userId,
      createdAt: sourceTx.createdAt,
      updatedAt: new Date(),
    };

    const destEntity: FinancialTransactionEntity = {
      id: destTx.id,
      organizationId: destTx.organizationId,
      financialAccountId: destinationAccountId,
      type: 'TRANSFER',
      direction: 'INFLOW',
      amount,
      currency: 'XOF',
      category: 'OTHER',
      status: 'POSTED',
      transferId,
      referenceType: 'transfer',
      referenceId: transferId,
      description: destTx.description,
      transactionDate: destTx.transactionDate,
      createdBy: ctx.userId,
      createdAt: destTx.createdAt,
      updatedAt: new Date(),
    };

    const result = { sourceTransaction: sourceEntity, destinationTransaction: destEntity };

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'FUND_TRANSFER_COMPLETED',
      targetEntity: 'transfer',
      targetId: transferId,
      afterState: { sourceAccountId, destinationAccountId, amount, transferId },
    });

    await this.eventRepo.recordEvent({
      organizationId: ctx.organizationId,
      eventType: 'finance.transfer_completed',
      payload: { transferId, sourceAccountId, destinationAccountId, amount },
    });

    if (idempotencyKey) {
      await this.idempotencyService.save(
        idempotencyKey,
        ctx.organizationId,
        { sourceAccountId, destinationAccountId, amount },
        result
      );
    }

    return result;
  }
}

export class OwnerDrawService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly eventRepo: IEventRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  async execute(
    financialAccountId: string,
    amount: number,
    reason: string = 'Wilty Personal Withdrawal (Owner Draw)',
    idempotencyKey?: string
  ): Promise<FinancialTransactionEntity> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    if (amount <= 0) {
      throw new ValidationError('Owner draw amount must be greater than 0.');
    }

    if (idempotencyKey) {
      const cached = await this.idempotencyService.check<FinancialTransactionEntity>(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, amount, reason }
      );
      if (cached) return cached;
    }

    const account = await this.financeRepo.getAccount(financialAccountId, ctx.organizationId);
    if (!account) throw new NotFoundError(`Financial account ${financialAccountId} not found.`);

    const recorded = await this.financeRepo.recordTransaction({
      organizationId: ctx.organizationId,
      financialAccountId,
      type: 'EXPENSE',
      amount,
      currency: 'XOF',
      category: 'OWNER_DRAW',
      referenceType: 'adjustment',
      referenceId: null,
      description: `[OWNER DRAW - EQUITY OUTFLOW] ${reason}`,
      transactionDate: new Date(),
      createdBy: ctx.userId,
    });

    const currentBal = (account as any).currentBalance ?? account.openingBalance;
    await this.financeRepo.updateAccountBalance(account.id, ctx.organizationId, currentBal - amount);

    const txEntity: FinancialTransactionEntity = {
      id: recorded.id,
      organizationId: recorded.organizationId,
      financialAccountId,
      type: 'EXPENSE',
      direction: 'OUTFLOW',
      amount,
      currency: 'XOF',
      category: 'OWNER_DRAW',
      status: 'POSTED',
      referenceType: 'adjustment',
      description: recorded.description,
      transactionDate: recorded.transactionDate,
      createdBy: ctx.userId,
      createdAt: recorded.createdAt,
      updatedAt: new Date(),
    };

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'OWNER_DRAW_RECORDED',
      targetEntity: 'transaction',
      targetId: txEntity.id,
      afterState: { accountId: financialAccountId, amount, reason },
    });

    await this.eventRepo.recordEvent({
      organizationId: ctx.organizationId,
      eventType: 'finance.owner_draw_created',
      payload: { transactionId: txEntity.id, accountId: financialAccountId, amount, reason },
    });

    if (idempotencyKey) {
      await this.idempotencyService.save(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, amount, reason },
        txEntity
      );
    }

    return txEntity;
  }
}

export class OwnerContributionService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly eventRepo: IEventRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  async execute(
    financialAccountId: string,
    amount: number,
    reason: string = 'Wilty Personal Capital Injection (Owner Contribution)',
    idempotencyKey?: string
  ): Promise<FinancialTransactionEntity> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    if (amount <= 0) {
      throw new ValidationError('Owner contribution amount must be greater than 0.');
    }

    if (idempotencyKey) {
      const cached = await this.idempotencyService.check<FinancialTransactionEntity>(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, amount, reason }
      );
      if (cached) return cached;
    }

    const account = await this.financeRepo.getAccount(financialAccountId, ctx.organizationId);
    if (!account) throw new NotFoundError(`Financial account ${financialAccountId} not found.`);

    const recorded = await this.financeRepo.recordTransaction({
      organizationId: ctx.organizationId,
      financialAccountId,
      type: 'INCOME',
      amount,
      currency: 'XOF',
      category: 'OWNER_CONTRIBUTION',
      referenceType: 'adjustment',
      referenceId: null,
      description: `[OWNER CONTRIBUTION - EQUITY INFLOW] ${reason}`,
      transactionDate: new Date(),
      createdBy: ctx.userId,
    });

    const currentBal = (account as any).currentBalance ?? account.openingBalance;
    await this.financeRepo.updateAccountBalance(account.id, ctx.organizationId, currentBal + amount);

    const txEntity: FinancialTransactionEntity = {
      id: recorded.id,
      organizationId: recorded.organizationId,
      financialAccountId,
      type: 'INCOME',
      direction: 'INFLOW',
      amount,
      currency: 'XOF',
      category: 'OWNER_CONTRIBUTION',
      status: 'POSTED',
      referenceType: 'adjustment',
      description: recorded.description,
      transactionDate: recorded.transactionDate,
      createdBy: ctx.userId,
      createdAt: recorded.createdAt,
      updatedAt: new Date(),
    };

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'OWNER_CONTRIBUTION_RECORDED',
      targetEntity: 'transaction',
      targetId: txEntity.id,
      afterState: { accountId: financialAccountId, amount, reason },
    });

    await this.eventRepo.recordEvent({
      organizationId: ctx.organizationId,
      eventType: 'finance.owner_contribution_created',
      payload: { transactionId: txEntity.id, accountId: financialAccountId, amount, reason },
    });

    if (idempotencyKey) {
      await this.idempotencyService.save(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, amount, reason },
        txEntity
      );
    }

    return txEntity;
  }
}

export class ReconciliationService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly eventRepo: IEventRepository,
    private readonly idempotencyService: IdempotencyService
  ) {}

  async execute(
    financialAccountId: string,
    actualBalance: number,
    justification: string,
    idempotencyKey?: string
  ): Promise<{ systemBalance: number; actualBalance: number; difference: number; adjustmentTransaction?: FinancialTransactionEntity }> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    if (idempotencyKey) {
      const cached = await this.idempotencyService.check<any>(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, actualBalance, justification }
      );
      if (cached) return cached;
    }

    const account = await this.financeRepo.getAccount(financialAccountId, ctx.organizationId);
    if (!account) throw new NotFoundError(`Financial account ${financialAccountId} not found.`);

    const systemBalance = (account as any).currentBalance ?? account.openingBalance;
    const difference = actualBalance - systemBalance;

    let adjustmentTx: FinancialTransactionEntity | undefined;

    if (difference !== 0) {
      if (!justification || justification.trim().length === 0) {
        throw new ValidationError('A detailed justification is required when adjusting an account discrepancy.');
      }

      const direction = difference > 0 ? 'INFLOW' : 'OUTFLOW';
      const absAmount = Math.abs(difference);

      const recorded = await this.financeRepo.recordTransaction({
        organizationId: ctx.organizationId,
        financialAccountId,
        type: difference > 0 ? 'INCOME' : 'EXPENSE',
        amount: absAmount,
        currency: 'XOF',
        category: 'RECONCILIATION_ADJUSTMENT',
        referenceType: 'adjustment',
        referenceId: null,
        description: `[RECONCILIATION ADJUSTMENT] Diff: ${difference} FCFA. ${justification}`,
        transactionDate: new Date(),
        createdBy: ctx.userId,
      });

      await this.financeRepo.updateAccountBalance(account.id, ctx.organizationId, actualBalance);

      adjustmentTx = {
        id: recorded.id,
        organizationId: recorded.organizationId,
        financialAccountId,
        type: recorded.type,
        direction,
        amount: absAmount,
        currency: 'XOF',
        category: 'RECONCILIATION_ADJUSTMENT',
        status: 'POSTED',
        referenceType: 'adjustment',
        description: recorded.description,
        transactionDate: recorded.transactionDate,
        createdBy: ctx.userId,
        createdAt: recorded.createdAt,
        updatedAt: new Date(),
      };

      await this.eventRepo.recordEvent({
        organizationId: ctx.organizationId,
        eventType: 'finance.reconciliation_difference_detected',
        payload: { accountId: financialAccountId, systemBalance, actualBalance, difference, justification },
      });
    }

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'ACCOUNT_RECONCILED',
      targetEntity: 'financial_account',
      targetId: financialAccountId,
      afterState: { systemBalance, actualBalance, difference, justification },
    });

    const result = { systemBalance, actualBalance, difference, adjustmentTransaction: adjustmentTx };

    if (idempotencyKey) {
      await this.idempotencyService.save(
        idempotencyKey,
        ctx.organizationId,
        { financialAccountId, actualBalance, justification },
        result
      );
    }

    return result;
  }
}

export class FinancialObligationService {
  constructor(
    private readonly financeRepo: IFinanceRepository,
    private readonly auditService: AuditService
  ) {}

  async create(
    type: ObligationType,
    partyType: ObligationPartyType,
    partyName: string,
    amount: number,
    dueDate?: Date,
    description?: string,
    partyId?: string
  ): Promise<FinancialObligationEntity> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:write');

    if (!partyName || partyName.trim().length === 0) {
      throw new ValidationError('Party name is required for financial obligations.');
    }
    if (amount <= 0) {
      throw new ValidationError('Obligation amount must be greater than 0.');
    }

    const created = await this.financeRepo.createObligation({
      organizationId: ctx.organizationId,
      type,
      partyType,
      partyId: partyId || null,
      partyName,
      amount,
      paidAmount: 0,
      remainingAmount: amount,
      dueDate: dueDate || null,
      status: 'PENDING',
      description: description || null,
    });

    await this.auditService.log({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'FINANCIAL_OBLIGATION_CREATED',
      targetEntity: 'financial_obligation',
      targetId: created.id,
      afterState: { type, partyName, amount, dueDate },
    });

    return created;
  }

  async list(type?: ObligationType): Promise<FinancialObligationEntity[]> {
    const ctx = await getOrganizationContext();
    return this.financeRepo.listObligationsByOrg(ctx.organizationId, type);
  }
}

export class FinanceSummaryService {
  constructor(private readonly financeRepo: IFinanceRepository) {}

  async getSummary(): Promise<FinanceSummaryMetrics> {
    const ctx = await getOrganizationContext();
    verifyPermission(ctx.role, 'finance:read');

    const accounts = await this.financeRepo.listAccountsByOrg(ctx.organizationId);
    const transactionsRaw = await this.financeRepo.listAllTransactionsByOrg(ctx.organizationId);
    const obligations = await this.financeRepo.listObligationsByOrg(ctx.organizationId);

    const balances = accounts.map((a) => (a as any).currentBalance ?? a.openingBalance);

    const transactions: FinancialTransactionEntity[] = transactionsRaw.map((t) => ({
      id: t.id,
      organizationId: t.organizationId,
      financialAccountId: t.financialAccountId,
      type: t.type,
      direction: (t as any).direction || FinanceInvariants.getDirectionForCategory(t.category as any),
      amount: t.amount,
      currency: t.currency,
      category: t.category as any,
      status: (t as any).status || 'POSTED',
      referenceType: t.referenceType as any,
      referenceId: t.referenceId,
      transferId: (t as any).transferId,
      receiptUrl: (t as any).receiptUrl,
      description: t.description,
      transactionDate: t.transactionDate,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
      updatedAt: new Date(),
    }));

    const debts = obligations
      .filter((o) => o.type === 'DEBT' && o.status !== 'PAID' && o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.remainingAmount, 0);

    const receivables = obligations
      .filter((o) => o.type === 'RECEIVABLE' && o.status !== 'PAID' && o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.remainingAmount, 0);

    return FinanceInvariants.calculateMetrics(balances, transactions, debts, receivables);
  }
}
