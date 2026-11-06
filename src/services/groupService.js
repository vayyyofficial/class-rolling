import { supabase } from './supabase';
import { storageService } from './storageService';
import { studentService } from './studentService';
import { shuffleArray } from '../utils/randomizer';

const STORAGE_KEYS = {
  CURRENT_GROUPS: 'current_group_generation',
  GROUP_HISTORY: 'group_generations_history',
};

export const groupService = {
  /**
   * Generates balanced groups from active students.
   * If Supabase is available and migration applied, calls RPC `generate_groups`.
   * Otherwise uses local Fisher-Yates and saves to storage.
   */
  async generateGroups(numGroups = 4, userId = null) {
    if (numGroups < 2 || numGroups > 26) {
      throw new Error('Jumlah kelompok harus antara 2 dan 26 kelompok.');
    }

    // Try Supabase RPC first
    try {
      const { data, error } = await supabase.rpc('generate_groups', {
        p_num_groups: numGroups,
        p_user_id: userId,
      });

      if (!error && data?.success) {
        // Fetch full generated groups with student details
        const fullGroups = await this.getLatestGroupGeneration();
        if (fullGroups) {
          storageService.set(STORAGE_KEYS.CURRENT_GROUPS, fullGroups);
          return fullGroups;
        }
      }
    } catch (err) {
      console.warn('[groupService] Supabase RPC fallback to local algorithm:', err);
    }

    // Fallback: Balanced client-side Fisher-Yates algorithm
    const students = await studentService.getStudents();
    const activeStudents = students.filter((s) => s.isActive !== false);

    if (activeStudents.length < numGroups) {
      throw new Error(`Jumlah siswa (${activeStudents.length}) kurang dari jumlah kelompok (${numGroups}).`);
    }

    const shuffled = shuffleArray(activeStudents);
    const groups = Array.from({ length: numGroups }, (_, i) => ({
      groupNumber: i + 1,
      name: `Kelompok ${i + 1}`,
      members: [],
    }));

    // Round-robin distribution for perfectly balanced group sizes
    shuffled.forEach((student, index) => {
      const groupIndex = index % numGroups;
      groups[groupIndex].members.push(student);
    });

    const generation = {
      id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      numGroups,
      studentCount: activeStudents.length,
      groups,
    };

    // Save locally
    storageService.set(STORAGE_KEYS.CURRENT_GROUPS, generation);

    // Add to history
    const history = this.getGroupHistory();
    const updatedHistory = [generation, ...history].slice(0, 30);
    storageService.set(STORAGE_KEYS.GROUP_HISTORY, updatedHistory);

    return generation;
  },

  /**
   * Retrieves the latest generated groups (from Supabase or storage)
   */
  async getLatestGroupGeneration() {
    try {
      const { data: gen, error: genErr } = await supabase
        .from('group_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!genErr && gen) {
        // Get members with student info
        const { data: members, error: memErr } = await supabase
          .from('group_generation_members')
          .select(`
            group_number,
            students:student_id (id, number, full_name, nickname, is_active)
          `)
          .eq('group_generation_id', gen.id)
          .order('group_number', { ascending: true });

        if (!memErr && members) {
          const groupMap = {};
          for (let i = 1; i <= gen.num_groups; i++) {
            groupMap[i] = {
              groupNumber: i,
              name: `Kelompok ${i}`,
              members: [],
            };
          }

          members.forEach((m) => {
            if (m.students && groupMap[m.group_number]) {
              groupMap[m.group_number].members.push({
                id: m.students.id,
                number: m.students.number,
                fullName: m.students.full_name,
                nickname: m.students.nickname,
                isActive: m.students.is_active,
              });
            }
          });

          const result = {
            id: gen.id,
            createdAt: gen.created_at,
            numGroups: gen.num_groups,
            studentCount: gen.student_count,
            groups: Object.values(groupMap),
          };

          storageService.set(STORAGE_KEYS.CURRENT_GROUPS, result);
          return result;
        }
      }
    } catch (err) {
      console.warn('[groupService] Failed to fetch groups from Supabase:', err);
    }

    return storageService.get(STORAGE_KEYS.CURRENT_GROUPS, null);
  },

  /**
   * Gets history of past group generations
   */
  getGroupHistory() {
    return storageService.get(STORAGE_KEYS.GROUP_HISTORY, []);
  },

  /**
   * Formats group results into clean text for copying to WhatsApp / chat
   */
  formatGroupsForCopy(generation) {
    if (!generation || !generation.groups) return '';

    const lines = [
      `*HASIL PEMBAGIAN KELOMPOK — SEATFLOW*`,
      `📅 Tanggal: ${new Date(generation.createdAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}`,
      `👥 Total: ${generation.studentCount} Siswa | ${generation.numGroups} Kelompok`,
      `────────────────────────────`,
    ];

    generation.groups.forEach((g) => {
      lines.push(`\n*${g.name}* (${g.members.length} Siswa):`);
      g.members.forEach((m, idx) => {
        lines.push(`${idx + 1}. ${m.nickname} (${m.fullName})`);
      });
    });

    lines.push(`\n_Dibuat otomatis oleh SeatFlow Classroom Management_`);
    return lines.join('\n');
  },

  /**
   * Subscribe to Supabase Realtime for instant group updates
   */
  subscribeToGroupChanges(onUpdate) {
    try {
      const channel = supabase
        .channel('public:group_generations')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_generations' },
          async () => {
            const latest = await groupService.getLatestGroupGeneration();
            if (latest && onUpdate) onUpdate(latest);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  },
};
