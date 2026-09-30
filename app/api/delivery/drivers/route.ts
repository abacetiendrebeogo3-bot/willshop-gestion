import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/src/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, organizationId, role, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER']);
    if (errorResponse) return errorResponse;

    // 3. Parse driver details
    const body = await request.json();
    const { name, phone, vehicle, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom du livreur est requis.' }, { status: 400 });
    }

    // 4. Insert into drivers table
    const { data: driverRow, error: insertErr } = await supabaseAdmin
      .from('drivers')
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        phone: phone ? phone.trim() : '+22670000000',
        vehicle: vehicle || 'MOTO',
        status: status || 'AVAILABLE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Error inserting driver:', insertErr);
      return NextResponse.json(
        { error: `Échec de création du livreur : ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      driver: driverRow,
    });
  } catch (error: any) {
    console.error('Error in POST /api/delivery/drivers:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur lors de la création du livreur' },
      { status: 500 }
    );
  }
}
