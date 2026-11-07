"use server";

import { requirePermission } from "@/lib/auth/action-authz";
import {
  createManualReservation as createManualReservationService,
  updateManualReservation as updateManualReservationService,
  deleteManualReservation as deleteManualReservationService,
  getVillaAvailabilitySnapshot as getVillaAvailabilitySnapshotService,
} from "@/app/services/manualReservation.service";
import { assertVillaAcceptsRentalBooking } from "@/app/services/reservation/_helpers/rental-listing-verify";
import { manualReservationServerRepository } from "@/lib/db/manual-reservation.repository.server";

/* ===============================================================
   🛡️ MANUAL RESERVATION — SERVER ACTIONS (thin wrapper, FAZ 4 S2)
   ===============================================================
   Admin client'lar (ManualReservationForm, ManualReservationList) →
   bu server action'lar → `manualReservation.service` (server) → native repo.

   ⚠️ İNCE WRAPPER: iş mantığı YOK — yalnız service'i delege eder. İmzalar +
     dönüş tipleri service'ten türetilir (Parameters/ReturnType → cast/any
     YOK, birebir). Validation, 23P01 overlap parse, activity log, TR hata
     mesajları, response şekli hepsi service'te AYNEN.
   =============================================================== */

export async function createManualReservationAction(
  ...args: Parameters<typeof createManualReservationService>
): ReturnType<typeof createManualReservationService> {
  await requirePermission("manual_reservations");
  /* 🛡️ SATILIK MODÜLÜ — satılık-only mülke yeni blok YOK (migration 103). */
  await assertVillaAcceptsRentalBooking(args[0]?.villa_id);
  return createManualReservationService(...args);
}

export async function updateManualReservationAction(
  ...args: Parameters<typeof updateManualReservationService>
): ReturnType<typeof updateManualReservationService> {
  await requirePermission("manual_reservations");
  /* 🛡️ SATILIK MODÜLÜ — blok BAŞKA bir villaya taşınıyorsa hedef
     satılık-only olamaz. Villa değişmiyorsa guard DB okumadan geçer →
     mevcut blokların düzenlenmesi AYNEN çalışır. */
  const [blockId, patch] = args;
  if (patch?.villa_id) {
    const { data: existing } =
      await manualReservationServerRepository.findById(blockId);
    await assertVillaAcceptsRentalBooking(patch.villa_id, {
      currentVillaId:
        (existing as { villa_id?: string | null } | null)?.villa_id ?? null,
    });
  }
  return updateManualReservationService(...args);
}

export async function deleteManualReservationAction(
  ...args: Parameters<typeof deleteManualReservationService>
): ReturnType<typeof deleteManualReservationService> {
  await requirePermission("manual_reservations");
  return deleteManualReservationService(...args);
}

export async function getVillaAvailabilitySnapshotAction(
  ...args: Parameters<typeof getVillaAvailabilitySnapshotService>
): ReturnType<typeof getVillaAvailabilitySnapshotService> {
  await requirePermission("manual_reservations");
  return getVillaAvailabilitySnapshotService(...args);
}
