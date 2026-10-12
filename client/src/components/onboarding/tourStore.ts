import { create } from 'zustand';

const TOUR_STORAGE_PREFIX = 'taskflow_tour_completed_';

export type TourType = 'global' | 'my-tasks' | 'team-settings' | 'team-workspace' | 'trash' | 'teams';

interface TourState {
  open: boolean;
  tourType: TourType;
  currentStep: number;
  setOpen: (open: boolean) => void;
  setCurrentStep: (step: number) => void;
  openTour: (type?: TourType) => void;
  closeTour: () => void;
  markCompleted: (userId?: string, type?: TourType) => void;
  isCompleted: (userId?: string, type?: TourType) => void;
  checkAutoStart: (userId?: string) => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  open: false,
  tourType: 'global',
  currentStep: 0,

  setOpen: (open) => set({ open }),
  setCurrentStep: (currentStep) => set({ currentStep }),

  openTour: (type = 'global') => {
    set({
      open: true,
      tourType: type,
      currentStep: 0,
    });
  },

  closeTour: () => {
    set({ open: false });
  },

  isCompleted: (userId?: string, type: TourType = 'global') => {
    const key = `${TOUR_STORAGE_PREFIX}${type}_${userId || 'guest'}`;
    return localStorage.getItem(key) === 'true';
  },

  markCompleted: (userId?: string, type?: TourType) => {
    const activeType = type || get().tourType;
    const key = `${TOUR_STORAGE_PREFIX}${activeType}_${userId || 'guest'}`;
    localStorage.setItem(key, 'true');
    set({ open: false });
  },

  checkAutoStart: (userId?: string) => {
    // 只有全局新手指引支持自动检测启动
    const key = `${TOUR_STORAGE_PREFIX}global_${userId || 'guest'}`;
    if (localStorage.getItem(key) !== 'true') {
      setTimeout(() => {
        get().openTour('global');
      }, 600);
    }
  },
}));
