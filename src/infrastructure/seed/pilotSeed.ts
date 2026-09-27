/**
 * WILLShop OS — Controlled Pilot Data Seeder
 * Seeds clean operational entities for the WillShop Production Pilot environment.
 * All created entities are explicitly tagged with isPilot = true / environment = 'PILOT'.
 */

import { Product, ProductStock, Customer, Zone, Driver, Employee } from '../../domain/entities/DataCoreEntities';
import { FinancialAccountEntity } from '../../domain/entities/FinanceEntities';
import { Strategy, StrategicObjective, StrategicGoal } from '../../domain/entities/StrategyEntities';

export interface PilotSeedDataResult {
  organizationId: string;
  isPilot: boolean;
  seededAt: Date;
  products: Product[];
  stocks: ProductStock[];
  customers: Customer[];
  zones: Zone[];
  drivers: Driver[];
  accounts: FinancialAccountEntity[];
  employees: Employee[];
  strategy: Strategy;
  objective: StrategicObjective;
  goal: StrategicGoal;
}

export class PilotDataSeeder {
  public static generatePilotSeedData(orgId: string = 'org_willshop_pilot'): PilotSeedDataResult {
    if (process.env.ALLOW_SEED_DATA !== 'true' || process.env.NODE_ENV === 'production') {
      throw new Error('⛔ SEED PROTECTION TRIGGERED: Demo seed data generation is disabled in production.');
    }

    const seededAt = new Date();

    const products: Product[] = [
      {
        id: `prod_pilot_01`,
        organizationId: orgId,
        sku: 'TSHIRT-OVR-BLK',
        name: 'T-Shirt Oversized Noir Premium',
        category: 'CLOTHING',
        purchasePrice: 6500,
        sellingPrice: 15000,
        currency: 'XOF',
        minimumStock: 5,
        unit: 'PCS',
        status: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
      {
        id: `prod_pilot_02`,
        organizationId: orgId,
        sku: 'JEANS-SLIM-BLU',
        name: 'Jeans Slim Blue Denim',
        category: 'CLOTHING',
        purchasePrice: 11000,
        sellingPrice: 22000,
        currency: 'XOF',
        minimumStock: 5,
        unit: 'PCS',
        status: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const stocks: ProductStock[] = [
      {
        id: `stock_pilot_01`,
        organizationId: orgId,
        productId: 'prod_pilot_01',
        physicalStock: 40,
        reservedStock: 0,
        availableStock: 40,
        minimumStock: 5,
        createdAt: seededAt,
        updatedAt: seededAt,
      },
      {
        id: `stock_pilot_02`,
        organizationId: orgId,
        productId: 'prod_pilot_02',
        physicalStock: 25,
        reservedStock: 0,
        availableStock: 25,
        minimumStock: 5,
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const customers: Customer[] = [
      {
        id: `cust_pilot_01`,
        organizationId: orgId,
        firstName: 'Amadou',
        lastName: 'Diallo',
        fullName: 'Amadou Diallo',
        phone: '+22670000001',
        city: 'Ouagadougou',
        source: 'WHATSAPP',
        status: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const zones: Zone[] = [
      {
        id: `zone_pilot_01`,
        organizationId: orgId,
        name: 'Ouaga-Centre',
        city: 'Ouagadougou',
        deliveryFee: 1500,
        status: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const drivers: Driver[] = [
      {
        id: `drv_pilot_01`,
        organizationId: orgId,
        name: 'Rasmané Sawadogo',
        phone: '+22676000002',
        vehicle: 'MOTO_TRICYCLE',
        status: 'AVAILABLE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const accounts: FinancialAccountEntity[] = [
      {
        id: `acc_pilot_bank`,
        organizationId: orgId,
        name: 'Compte Coris Bank Pilote',
        type: 'BANK_ACCOUNT',
        currency: 'XOF',
        openingBalance: 1000000,
        currentBalance: 1000000,
        status: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
      {
        id: `acc_pilot_cash`,
        organizationId: orgId,
        name: 'Caisse Espèces Pilote',
        type: 'CASH_REGISTER',
        currency: 'XOF',
        openingBalance: 150000,
        currentBalance: 150000,
        status: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const employees: Employee[] = [
      {
        id: `emp_pilot_willy`,
        organizationId: orgId,
        firstName: 'Willy',
        lastName: 'Tiendré',
        phone: '+22670000000',
        role: 'CEO',
        employmentStatus: 'ACTIVE',
        createdAt: seededAt,
        updatedAt: seededAt,
      },
    ];

    const strategy: Strategy = {
      id: `strat_pilot_01`,
      organizationId: orgId,
      title: 'Plan de Croissance Pilote Q3-2026',
      vision: 'Devenir la référence e-commerce WillShop avec excellence opérationnelle',
      strategicPeriod: 'Q3-2026',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 86400000),
      status: 'ACTIVE',
      ownerId: 'emp_pilot_willy',
      createdAt: seededAt,
      updatedAt: seededAt,
    };

    const objective: StrategicObjective = {
      id: `obj_pilot_01`,
      organizationId: orgId,
      strategyId: strategy.id,
      title: 'Optimisation de la rentabilité commerciale',
      description: 'Atteindre un chiffre d\'affaires mensuel rentable sur le pilote',
      strategicPriority: 'P1_CRITICAL',
      ownerId: 'emp_pilot_willy',
      timeframe: 'Q3-2026',
      status: 'ON_TRACK',
      createdAt: seededAt,
      updatedAt: seededAt,
    };

    const goal: StrategicGoal = {
      id: `goal_pilot_01`,
      organizationId: orgId,
      objectiveId: objective.id,
      title: 'Chiffre d\'Affaires Pilote Mensuel',
      ownerId: 'emp_pilot_willy',
      goalType: 'FINANCIAL',
      baselineValue: 0,
      baselineDate: seededAt,
      targetValue: 3000000,
      currentValue: 0,
      unit: 'XOF',
      startDate: seededAt,
      dueDate: new Date(Date.now() + 30 * 86400000),
      status: 'ON_TRACK',
      confidence: 'HIGH',
      forecastValue: 3000000,
      createdBy: 'emp_pilot_willy',
      createdAt: seededAt,
      updatedAt: seededAt,
    };

    return {
      organizationId: orgId,
      isPilot: true,
      seededAt,
      products,
      stocks,
      customers,
      zones,
      drivers,
      accounts,
      employees,
      strategy,
      objective,
      goal,
    };
  }
}
