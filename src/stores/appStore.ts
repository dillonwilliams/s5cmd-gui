import { create } from 'zustand';
import type {
  Profile,
  S3Bucket,
  Settings,
  ClipboardState,
  SortState,
  NavigationEntry,
  OperationProgress,
} from '../types';
import * as api from '../api';

interface AppState {
  // Profile state
  profiles: Profile[];
  activeProfile: Profile | null;
  profilesLoading: boolean;

  // Bucket state
  buckets: S3Bucket[];
  selectedBucket: S3Bucket | null;
  bucketsLoading: boolean;

  // Navigation state
  currentPath: string;
  navigationHistory: NavigationEntry[];
  historyIndex: number;

  // Clipboard state
  clipboard: ClipboardState;

  // Sort state
  sort: SortState;

  // Filter state
  searchQuery: string;

  // Settings state
  settings: Settings | null;

  // Operations state
  activeOperations: OperationProgress[];

  // UI state
  isSettingsOpen: boolean;
  isProfileDialogOpen: boolean;
  isLogsDialogOpen: boolean;

  // Error state
  error: string | null;

  // Actions
  loadProfiles: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  loadBuckets: () => Promise<void>;
  selectBucket: (bucket: S3Bucket) => void;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  setClipboard: (clipboard: ClipboardState) => void;
  clearClipboard: () => void;
  setSort: (sort: SortState) => void;
  setSearchQuery: (query: string) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  addOperation: (operation: OperationProgress) => void;
  updateOperation: (operation: OperationProgress) => void;
  removeOperation: (operationId: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setProfileDialogOpen: (open: boolean) => void;
  setLogsDialogOpen: (open: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  profiles: [],
  activeProfile: null,
  profilesLoading: false,
  buckets: [],
  selectedBucket: null,
  bucketsLoading: false,
  currentPath: '',
  navigationHistory: [],
  historyIndex: -1,
  clipboard: { items: [], operation: null },
  sort: { column: 'name', direction: 'asc' },
  searchQuery: '',
  settings: null,
  activeOperations: [],
  isSettingsOpen: false,
  isProfileDialogOpen: false,
  isLogsDialogOpen: false,
  error: null,

  // Actions
  loadProfiles: async () => {
    set({ profilesLoading: true });
    try {
      const profiles = await api.getProfiles();
      const activeProfile = profiles.find((p) => p.is_active) || null;
      set({ profiles, activeProfile, profilesLoading: false });

      // If we have an active profile, load buckets
      if (activeProfile) {
        get().loadBuckets();
      }
    } catch (error) {
      set({
        profilesLoading: false,
        error: `Failed to load profiles: ${error}`,
      });
    }
  },

  selectProfile: async (profileId: string) => {
    try {
      await api.setActiveProfile(profileId);
      const profiles = await api.getProfiles();
      const activeProfile = profiles.find((p) => p.id === profileId) || null;
      set({
        profiles,
        activeProfile,
        selectedBucket: null,
        currentPath: '',
        navigationHistory: [],
        historyIndex: -1,
      });

      // Load buckets for new profile
      if (activeProfile) {
        get().loadBuckets();
      }
    } catch (error) {
      set({ error: `Failed to select profile: ${error}` });
    }
  },

  loadBuckets: async () => {
    set({ bucketsLoading: true });
    try {
      const buckets = await api.listBuckets();
      set({ buckets, bucketsLoading: false });
    } catch (error) {
      set({
        buckets: [],
        bucketsLoading: false,
        error: `Failed to load buckets: ${error}`,
      });
    }
  },

  selectBucket: (bucket: S3Bucket) => {
    const path = `s3://${bucket.name}/`;
    set({
      selectedBucket: bucket,
      currentPath: path,
      navigationHistory: [{ bucket: bucket.name, path }],
      historyIndex: 0,
    });
  },

  navigate: (path: string) => {
    const { navigationHistory, historyIndex } = get();

    // Parse the bucket from path
    const match = path.match(/^s3:\/\/([^/]+)/);
    const bucket = match ? match[1] : '';

    // Trim history after current index and add new entry
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push({ bucket, path });

    set({
      currentPath: path,
      navigationHistory: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  goBack: () => {
    const { navigationHistory, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const entry = navigationHistory[newIndex];
      set({
        currentPath: entry.path,
        historyIndex: newIndex,
      });
    }
  },

  goForward: () => {
    const { navigationHistory, historyIndex } = get();
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const entry = navigationHistory[newIndex];
      set({
        currentPath: entry.path,
        historyIndex: newIndex,
      });
    }
  },

  goUp: () => {
    const { currentPath, selectedBucket } = get();
    if (!selectedBucket) return;

    const bucketPrefix = `s3://${selectedBucket.name}/`;
    if (currentPath === bucketPrefix) return;

    // Remove last path segment
    const pathWithoutTrailingSlash = currentPath.replace(/\/$/, '');
    const lastSlash = pathWithoutTrailingSlash.lastIndexOf('/');
    const parentPath = pathWithoutTrailingSlash.substring(0, lastSlash + 1);

    get().navigate(parentPath || bucketPrefix);
  },

  setClipboard: (clipboard: ClipboardState) => {
    set({ clipboard });
  },

  clearClipboard: () => {
    set({ clipboard: { items: [], operation: null } });
  },

  setSort: (sort: SortState) => {
    set({ sort });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  loadSettings: async () => {
    try {
      const settings = await api.getSettings();
      set({ settings });
    } catch (error) {
      set({ error: `Failed to load settings: ${error}` });
    }
  },

  updateSettings: async (settings: Settings) => {
    try {
      await api.saveSettings(settings);
      set({ settings });
    } catch (error) {
      set({ error: `Failed to save settings: ${error}` });
    }
  },

  addOperation: (operation: OperationProgress) => {
    set((state) => ({
      activeOperations: [...state.activeOperations, operation],
    }));
  },

  updateOperation: (operation: OperationProgress) => {
    set((state) => ({
      activeOperations: state.activeOperations.map((op) =>
        op.id === operation.id ? operation : op
      ),
    }));
  },

  removeOperation: (operationId: string) => {
    set((state) => ({
      activeOperations: state.activeOperations.filter(
        (op) => op.id !== operationId
      ),
    }));
  },

  setSettingsOpen: (open: boolean) => {
    set({ isSettingsOpen: open });
  },

  setProfileDialogOpen: (open: boolean) => {
    set({ isProfileDialogOpen: open });
  },

  setLogsDialogOpen: (open: boolean) => {
    set({ isLogsDialogOpen: open });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));
