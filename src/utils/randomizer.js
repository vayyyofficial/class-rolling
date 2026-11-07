/**
 * CLASS ROLLING - Fisher-Yates Randomization Engine
 * Unbiased seating shuffle and assignment algorithm
 */

/**
 * Standard unbiased Fisher-Yates (Knuth) Shuffle
 * Returns a new shuffled array without mutating the original.
 */
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a new seating assignment given a layout and student list.
 * 
 * Rules:
 * - Only active students are assigned.
 * - Only available seats (isAvailable: true) can receive students.
 * - If defaultEmpty seats exist (or seats marked empty), they are prioritized to remain empty
 *   when total active seats > total active students.
 * - Every active student is assigned to exactly one seat.
 * - No two students share the same seat.
 * 
 * @param {Object} layout - Layout object with blocks and seats
 * @param {Array} students - Array of student objects
 * @returns {Object} { assignments: { [seatId]: studentId }, emptySeatIds: string[] }
 */
export function generateSeatingArrangement(layout, students) {
  // 1. Filter active students
  const activeStudents = (students || []).filter((s) => s.isActive);

  // 2. Collect all available seats across all blocks
  const allSeats = [];
  layout.blocks.forEach((block) => {
    block.seats.forEach((seat) => {
      if (seat.isAvailable) {
        allSeats.push(seat);
      }
    });
  });

  // Separate seats into normal available seats and designated empty seats
  const normalSeats = allSeats.filter((s) => !s.defaultEmpty);
  const preferredEmptySeats = allSeats.filter((s) => s.defaultEmpty);

  // Pool of candidate seats to fill
  // Prefer filling normal seats first, then preferredEmptySeats if needed
  let assignableSeats = [...normalSeats];
  if (assignableSeats.length < activeStudents.length) {
    const needed = activeStudents.length - assignableSeats.length;
    assignableSeats.push(...preferredEmptySeats.slice(0, needed));
  }

  // If assignable seats are more than active students, trim or keep surplus
  // Shuffle active students
  const shuffledStudents = shuffleArray(activeStudents);

  // Shuffle assignable seat slots so students get placed randomly
  const shuffledSeats = shuffleArray(assignableSeats);

  const assignments = {};
  const assignedSeatIds = new Set();

  shuffledStudents.forEach((student, index) => {
    if (index < shuffledSeats.length) {
      const seat = shuffledSeats[index];
      assignments[seat.id] = student.id;
      assignedSeatIds.add(seat.id);
    }
  });

  // Remaining seats are marked as empty
  const emptySeatIds = allSeats
    .filter((seat) => !assignedSeatIds.has(seat.id))
    .map((seat) => seat.id);

  return {
    assignments,
    emptySeatIds,
    timestamp: new Date().toISOString(),
  };
}

