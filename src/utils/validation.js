/**
 * CLASS ROLLING - Validation Utilities
 */

/**
 * Validates student data
 */
export function validateStudent(student) {
  const errors = {};

  if (!student.fullName || !student.fullName.trim()) {
    errors.fullName = 'Nama lengkap wajib diisi.';
  } else if (student.fullName.trim().length < 2) {
    errors.fullName = 'Nama lengkap minimal 2 karakter.';
  }

  if (!student.nickname || !student.nickname.trim()) {
    errors.nickname = 'Nama panggilan (nickname) wajib diisi.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates classroom layout integrity
 */
export function validateLayout(layout, activeStudentCount = 0) {
  const errors = [];
  const warnings = [];

  if (!layout || !layout.blocks || !Array.isArray(layout.blocks) || layout.blocks.length === 0) {
    errors.push('Tata letak harus memiliki minimal satu blok meja.');
    return { isValid: false, errors, warnings };
  }

  const seatIds = new Set();
  const seatCodes = new Set();
  let totalSeats = 0;
  let availableSeats = 0;

  layout.blocks.forEach((block, bIdx) => {
    if (!block.name || !block.name.trim()) {
      errors.push(`Blok #${bIdx + 1} harus memiliki nama.`);
    }

    if (block.rows < 1 || block.cols < 1) {
      errors.push(`Blok "${block.name || bIdx + 1}" harus memiliki minimal 1 baris dan 1 kolom.`);
    }

    if (!Array.isArray(block.seats)) {
      errors.push(`Daftar kursi pada blok "${block.name}" tidak valid.`);
      return;
    }

    block.seats.forEach((seat) => {
      totalSeats++;
      if (seat.isAvailable) availableSeats++;

      if (seatIds.has(seat.id)) {
        errors.push(`ID kursi ganda ditemukan: ${seat.id}`);
      }
      seatIds.add(seat.id);

      if (seat.code) {
        if (seatCodes.has(seat.code)) {
          warnings.push(`Nomor/kode kursi "${seat.code}" terduplikasi pada blok lain.`);
        }
        seatCodes.add(seat.code);
      }
    });
  });

  if (availableSeats < activeStudentCount) {
    errors.push(
      `Kapasitas kursi tersedia (${availableSeats}) kurang dari jumlah siswa aktif (${activeStudentCount}). Tambahkan kursi atau aktifkan kembali kursi nonaktif.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalSeats,
    availableSeats,
  };
}
