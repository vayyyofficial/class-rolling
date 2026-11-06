/**
 * SEATFLOW - Default Classroom Layout Configuration
 * 3 Blocks: Left (10 seats), Middle (10 seats), Right (8 seats)
 * Total: 28 positions. Exactly 2 positions empty at the back of right block.
 */
export const DEFAULT_LAYOUT = {
  id: 'layout-default',
  name: 'Denah Kelas Standar (3 Blok)',
  teacherDesk: {
    label: 'Meja Guru',
    position: 'center', // 'left' | 'center' | 'right'
  },
  blocks: [
    {
      id: 'block-left',
      name: 'Blok Kiri',
      cols: 2,
      rows: 5,
      seats: [
        { id: 'seat-01', code: '01', row: 0, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-02', code: '02', row: 0, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-03', code: '03', row: 1, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-04', code: '04', row: 1, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-05', code: '05', row: 2, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-06', code: '06', row: 2, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-07', code: '07', row: 3, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-08', code: '08', row: 3, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-09', code: '09', row: 4, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-10', code: '10', row: 4, col: 1, isAvailable: true, defaultEmpty: false },
      ],
    },
    {
      id: 'block-middle',
      name: 'Blok Tengah',
      cols: 2,
      rows: 5,
      seats: [
        { id: 'seat-11', code: '11', row: 0, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-12', code: '12', row: 0, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-13', code: '13', row: 1, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-14', code: '14', row: 1, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-15', code: '15', row: 2, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-16', code: '16', row: 2, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-17', code: '17', row: 3, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-18', code: '18', row: 3, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-19', code: '19', row: 4, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-20', code: '20', row: 4, col: 1, isAvailable: true, defaultEmpty: false },
      ],
    },
    {
      id: 'block-right',
      name: 'Blok Kanan',
      cols: 2,
      rows: 4,
      seats: [
        { id: 'seat-21', code: '21', row: 0, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-22', code: '22', row: 0, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-23', code: '23', row: 1, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-24', code: '24', row: 1, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-25', code: '25', row: 2, col: 0, isAvailable: true, defaultEmpty: false },
        { id: 'seat-26', code: '26', row: 2, col: 1, isAvailable: true, defaultEmpty: false },
        { id: 'seat-27', code: '27', row: 3, col: 0, isAvailable: true, defaultEmpty: true }, // Empty by default
        { id: 'seat-28', code: '28', row: 3, col: 1, isAvailable: true, defaultEmpty: true }, // Empty by default
      ],
    },
  ],
};

