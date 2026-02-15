// Mobility and flexibility routines safe for Forestier's disease (DISH) and OA

export interface Exercise {
  id: string;
  name: string;
  description: string;
  duration_seconds: number;
  reps: number | null;
  instructions: string[];
  caution: string | null;
}

export interface MobilityRoutineDefinition {
  id: string;
  name: string;
  duration_label: string;
  total_seconds: number;
  exercises: Exercise[];
}

export const QUICK_ROUTINE: MobilityRoutineDefinition = {
  id: 'quick_5min',
  name: 'Quick Mobility',
  duration_label: '5 minutes',
  total_seconds: 300,
  exercises: [
    {
      id: 'seated_hip_flexor',
      name: 'Seated Hip Flexor Stretch',
      description: 'Gentle hip flexor stretch from a chair',
      duration_seconds: 45,
      reps: null,
      instructions: [
        'Sit on the edge of a sturdy chair',
        'Slide your right leg back, keeping left foot flat on floor',
        'Lean slightly forward from hips until you feel a gentle stretch',
        'Hold for 20 seconds, then switch sides',
      ],
      caution: 'Keep your back straight — don\'t arch. Stop if you feel sharp pain.',
    },
    {
      id: 'cat_cow',
      name: 'Seated Cat-Cow',
      description: 'Gentle spinal mobilization from a chair',
      duration_seconds: 60,
      reps: 8,
      instructions: [
        'Sit tall on a chair with feet flat on floor',
        'Place hands on knees',
        'Inhale: gently arch your back, lift chest (cow)',
        'Exhale: round your back, tuck chin to chest (cat)',
        'Move slowly — 4 seconds each direction',
      ],
      caution: 'Keep movements small and controlled. No forced range of motion.',
    },
    {
      id: 'seated_twist',
      name: 'Gentle Seated Twist',
      description: 'Spinal rotation from a chair',
      duration_seconds: 60,
      reps: null,
      instructions: [
        'Sit tall with feet flat on floor',
        'Place right hand on left knee',
        'Gently rotate torso to the left',
        'Hold 15 seconds, breathe deeply',
        'Return to center and repeat on other side',
      ],
      caution: 'Rotate from mid-back, not lower back. Very gentle with Forestier\'s.',
    },
    {
      id: 'ankle_circles',
      name: 'Ankle Circles',
      description: 'Ankle mobility seated',
      duration_seconds: 45,
      reps: 10,
      instructions: [
        'Sit with one foot lifted slightly off the floor',
        'Slowly circle your ankle clockwise 10 times',
        'Then counter-clockwise 10 times',
        'Switch feet and repeat',
      ],
      caution: null,
    },
    {
      id: 'shoulder_rolls',
      name: 'Shoulder Rolls',
      description: 'Upper body tension release',
      duration_seconds: 45,
      reps: 10,
      instructions: [
        'Sit or stand comfortably',
        'Roll shoulders forward in big circles 10 times',
        'Then roll backward 10 times',
        'Finish by squeezing shoulder blades together for 5 seconds',
      ],
      caution: null,
    },
  ],
};

export const FULL_ROUTINE: MobilityRoutineDefinition = {
  id: 'full_10min',
  name: 'Full Mobility Routine',
  duration_label: '10 minutes',
  total_seconds: 600,
  exercises: [
    ...QUICK_ROUTINE.exercises,
    {
      id: 'seated_hamstring',
      name: 'Seated Hamstring Stretch',
      description: 'Hamstring stretch using a chair or strap',
      duration_seconds: 60,
      reps: null,
      instructions: [
        'Sit on edge of chair',
        'Extend one leg straight out with heel on floor',
        'Keep back straight and lean gently forward from hips',
        'Hold 20 seconds, then switch legs',
        'Optional: loop a towel around your foot for assistance',
      ],
      caution: 'Don\'t round your back. The stretch should be gentle.',
    },
    {
      id: 'standing_quad',
      name: 'Standing Quad Stretch (with support)',
      description: 'Quad stretch holding onto a wall or chair',
      duration_seconds: 60,
      reps: null,
      instructions: [
        'Stand next to a wall or sturdy chair for balance',
        'Bend right knee and bring heel toward glutes',
        'Hold ankle with right hand (or use a strap)',
        'Keep knees close together',
        'Hold 20 seconds, switch sides',
      ],
      caution: 'Hold onto support at all times. Don\'t force the stretch.',
    },
    {
      id: 'hip_circles',
      name: 'Gentle Hip Circles',
      description: 'Hip mobility standing',
      duration_seconds: 60,
      reps: 8,
      instructions: [
        'Stand with feet hip-width apart, holding support',
        'Slowly circle hips clockwise 8 times',
        'Then counter-clockwise 8 times',
        'Keep movements smooth and controlled',
      ],
      caution: 'Small circles only — don\'t force range of motion with OA.',
    },
    {
      id: 'neck_stretches',
      name: 'Gentle Neck Stretches',
      description: 'Neck tension release',
      duration_seconds: 60,
      reps: null,
      instructions: [
        'Sit tall, drop right ear toward right shoulder',
        'Hold 10 seconds',
        'Repeat on left side',
        'Gently drop chin to chest, hold 10 seconds',
        'Return to neutral slowly',
      ],
      caution: 'Very gentle with Forestier\'s. Never force or roll the neck.',
    },
    {
      id: 'deep_breathing',
      name: 'Deep Breathing Cooldown',
      description: 'Diaphragmatic breathing to finish',
      duration_seconds: 60,
      reps: 5,
      instructions: [
        'Sit comfortably with eyes closed',
        'Inhale slowly through nose for 4 counts',
        'Hold for 2 counts',
        'Exhale slowly through mouth for 6 counts',
        'Repeat 5 times',
      ],
      caution: null,
    },
  ],
};

export const ALL_ROUTINES = [QUICK_ROUTINE, FULL_ROUTINE];
