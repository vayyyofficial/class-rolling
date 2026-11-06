import React, { useState } from 'react';
import TeacherDesk from './TeacherDesk';
import SeatCard from './SeatCard';
import SeatDetailModal from './SeatDetailModal';
import { Info } from 'lucide-react';

export default function ClassroomMap({
  layout,
  students = [],
  assignments = {},
  highlightedStudentId = null,
  isShuffling = false,
  shuffleNames = {},
  editable = false,
  onToggleSeatAvailable,
}) {
  const [selectedSeatData, setSelectedSeatData] = useState(null);

  // Map student ID to student object
  const studentMap = React.useMemo(() => {
    const map = {};
    (students || []).forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  const handleSeatClick = (seat, student, blockName) => {
    setSelectedSeatData({ seat, student, blockName });
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Visual Classroom Frame */}
      <div className="w-full bg-white rounded-2xl border border-divider p-4 sm:p-8 shadow-subtle overflow-x-auto">
        <div className="min-w-[780px] max-w-5xl mx-auto flex flex-col items-center">
          
          {/* Front of Class & Teacher Desk */}
          <TeacherDesk
            position={layout.teacherDesk?.position || 'center'}
            label={layout.teacherDesk?.label || 'Meja Guru'}
          />

          {/* Classroom Layout: 3 Seating Blocks with Aisles */}
          <div className="w-full flex items-start justify-between gap-6 lg:gap-10">
            {(layout.blocks || []).map((block) => {
              return (
                <div
                  key={block.id}
                  className="flex-1 flex flex-col items-center bg-canvas/60 rounded-xl p-3 sm:p-4 border border-divider/80"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between w-full mb-3 px-1">
                    <span className="text-xs font-bold text-content-primary flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-brand-600" />
                      {block.name}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-content-secondary">
                      {block.seats.filter((s) => s.isAvailable !== false).length} Kursi
                    </span>
                  </div>

                  {/* Seats Grid */}
                  <div
                    className="grid gap-2.5 sm:gap-3 w-full"
                    style={{
                      gridTemplateColumns: `repeat(${block.cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {block.seats.map((seat) => {
                      const studentId = assignments[seat.id];
                      const student = studentId ? studentMap[studentId] : null;
                      const isHighlighted = highlightedStudentId && student?.id === highlightedStudentId;

                      return (
                        <SeatCard
                          key={seat.id}
                          seat={seat}
                          student={student}
                          isSelected={selectedSeatData?.seat?.id === seat.id}
                          isHighlighted={isHighlighted}
                          isShuffling={isShuffling}
                          shuffleName={shuffleNames[seat.id]}
                          editable={editable}
                          onToggleAvailable={onToggleSeatAvailable}
                          onClick={() => handleSeatClick(seat, student, block.name)}
                        />
                      );
                    })}
                  </div>

                  {/* Visual indication if block is shorter than others */}
                  {block.rows < 5 && (
                    <div className="w-full mt-2.5 p-2 rounded-lg border border-dashed border-gray-200 text-center">
                      <span className="text-[10px] text-gray-400 font-medium">Area Kosong Belakang</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Aisles & Legend */}
          <div className="w-full mt-8 pt-6 border-t border-divider flex flex-wrap items-center justify-between gap-4 text-xs text-content-secondary">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-divider bg-white shadow-xs" />
                <span>Kursi Terisi Siswa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-dashed border-gray-300 bg-white" />
                <span>Kursi Kosong (2 Posisi)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-dashed border-gray-300 bg-gray-100" />
                <span>Kursi Nonaktif</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-content-secondary">
              <Info className="w-3.5 h-3.5 text-brand-600" />
              <span>Klik pada salah satu kursi untuk melihat detail siswa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seat Detail Modal */}
      {selectedSeatData && (
        <SeatDetailModal
          isOpen={Boolean(selectedSeatData)}
          onClose={() => setSelectedSeatData(null)}
          seat={selectedSeatData.seat}
          student={selectedSeatData.student}
          blockName={selectedSeatData.blockName}
        />
      )}
    </div>
  );
}
