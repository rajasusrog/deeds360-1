import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  UserAccount, 
  UserRole, 
  UserProfile,
  ClientProfile, 
  DeedWizardState, 
  SavedDraft, 
  AuditLog, 
  SystemNotification, 
  DraftStatus,
  SyncStatus,
  getRoleAllowedTabs 
} from '../types';
import { 
  DUMMY_CLIENTS, 
  DRAFT_DEEDS, 
  DUMMY_NOTIFICATIONS 
} from '../utils/dummyData';
import { 
  supabase, 
  isSupabaseConfigured,
  signInWithGoogleOAuth, 
  signOutSupabase, 
  getActiveSession, 
  mapSupabaseUserToUserAccount,
  upsertUserProfileToSupabase,
  fetchUserProfilesFromSupabase,
  updateUserProfileRoleInSupabase,
  updateUserProfileStatusInSupabase,
  recordAuditLogInSupabase,
  SUPER_ADMIN_EMAILS
} from '../lib/supabase';
import {
  resolveDeedType,
  normalizeDeedCode,
  isDeedTemplateAvailable,
  partitionPartiesForDeedType,
  getDeedDisplayName
} from '../utils/deedTypes';

const generateClientSideUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export interface VersionConflictState {
  draftId: string;
  message: string;
  serverDocument?: SavedDraft;
  currentRevision?: number;
  localDraft: SavedDraft;
}

export interface SurveyConflictReviewState {
  draftId: string;
  message: string;
  conflicts: any[];
}

interface AppContextType {
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  simulationRole: UserRole | null;
  setSimulationRole: (role: UserRole | null) => void;
  effectiveRole: UserRole;
  authLoading: boolean;
  loginWithGoogleHandler: () => Promise<{ success: boolean; message: string; user?: UserAccount }>;
  logoutUser: () => Promise<void>;
  auditLogs: AuditLog[];
  refreshAuditLogs: () => Promise<void>;
  usersList: UserAccount[];
  userProfiles: UserProfile[];
  refreshUsersList: () => Promise<void>;
  refreshUserProfiles: () => Promise<UserProfile[]>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  updateUserStatus: (userId: string, newStatus: 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted' | 'active' | 'suspended' | 'pending' | 'deleted') => Promise<void>;
  syncDatabase: () => Promise<void>;
  
  savedDrafts: SavedDraft[];
  currentDraft: SavedDraft | null;
  activeStep: number;
  setActiveStep: (step: number) => void;
  autosaveStatus: SyncStatus;
  lastSaveError: string | null;
  hasUnsavedChanges: boolean;
  versionConflict: VersionConflictState | null;
  surveyConflictReview: SurveyConflictReviewState | null;
  clients: ClientProfile[];
  notifications: SystemNotification[];
  
  // Tab Routing
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // CRUD Operations
  createDraft: (docType: string, subType: string) => SavedDraft;
  loadDraft: (id: string) => void;
  updateCurrentDraftState: (state: DeedWizardState) => void;
  saveDraftManual: () => Promise<void>;
  retrySyncDraft: (draftId?: string) => Promise<boolean>;
  resolveVersionConflict: (resolution: 'keep-local' | 'use-server') => Promise<void>;
  acknowledgeSurveyConflictAndFinalize: (draftIdOrNotes?: string, optionalNotes?: string) => Promise<boolean>;
  dismissSurveyConflictReview: () => void;
  createDraftRevision: (id: string, notes?: string) => Promise<SavedDraft | null>;
  deleteDraft: (id: string) => Promise<void>;
  duplicateDraft: (id: string) => SavedDraft;
  updateDraftStatus: (id: string, status: DraftStatus, extraOptions?: { conflictReviewAcknowledged?: boolean; conflictReviewNotes?: string }) => Promise<boolean>;
  
  // Clients CRUD
  addClient: (client: ClientProfile) => Promise<void>;
  
  // Helper validations
  getStepCompletionStates: (state: DeedWizardState) => boolean[];
  calculateProgress: (state: DeedWizardState) => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Default blank wizard state helper
export const createDefaultState = (docType = 'SALE', subType = 'SALE_METRO'): DeedWizardState => {
  const canonicalCode = normalizeDeedCode(docType) || docType;
  const deedDef = resolveDeedType(canonicalCode);
  return {
    documentType: canonicalCode,
    documentSubtype: subType,
    parties: [
      {
        id: 'p1',
        role: deedDef?.grantorRole || 'Seller',
        name: '',
        fatherName: '',
        dob: '',
        age: 0,
        occupation: '',
        aadhaar: '',
        pan: '',
        phone: '',
        email: '',
        address: ''
      },
      {
        id: 'p2',
        role: deedDef?.granteeRole || 'Buyer',
        name: '',
        fatherName: '',
        dob: '',
        age: 0,
        occupation: '',
        aadhaar: '',
        pan: '',
        phone: '',
        email: '',
        address: ''
      }
    ],
    property: {
      district: 'Chennai',
      registrationDistrict: 'Chennai South',
      taluk: '',
      village: '',
      ward: '',
      block: '',
      propertyType: canonicalCode === 'LEASE' ? 'Commercial Building' : 'Residential Plot / Land',
      sro: '',
      doorNo: ''
    },
    survey: {
      surveyNo: '',
      subDivision: '',
      pattaNo: '',
      tslrNo: '',
      chittaRef: ''
    },
    surveys: [
      {
        surveyNo: '',
        subDivision: '',
        pattaNo: '',
        tslrNo: '',
        chittaRef: ''
      }
    ],
    extent: {
      sqft: 0,
      acre: 0,
      cent: 0,
      hectare: 0,
      areaUnit: 'Sq.ft',
      totalExtent: 0,
      eastWest: '',
      northSouth: '',
      builtUpArea: 0,
      uds: 0
    },
    boundary: {
      east: '',
      west: '',
      north: '',
      south: ''
    },
    ownershipHistory: {
      parentDocType: 'Sale Deed',
      parentDocNo: '',
      parentDocYear: '',
      parentDocSRO: '',
      parentDocDate: '',
      priorOwners: '',
      historyNarrative: ''
    },
    transaction: {
      marketValue: 0,
      guidelineValue: 0,
      considerationAmount: 0,
      advancePaid: 0,
      balancePaid: 0,
      paymentMode: 'NEFT/RTGS',
      paymentRefNo: '',
      paymentDate: '',
      bankName: ''
    },
    witnesses: [
      {
        id: 'w1',
        name: '',
        fatherName: '',
        age: 0,
        aadhaar: '',
        idProof: '',
        address: '',
        phone: '',
        occupation: ''
      },
      {
        id: 'w2',
        name: '',
        fatherName: '',
        age: 0,
        aadhaar: '',
        idProof: '',
        address: '',
        phone: '',
        occupation: ''
      }
    ],
    selectedClauses: ['cl1', 'cl2', 'cl3']
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state management - starts in loading state until Supabase session is verified
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const [simulationRole, setSimulationRole] = useState<UserRole | null>(() => {
    return localStorage.getItem('unikorn_simulation_role') as UserRole | null;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);

  // Derived effective role (UI simulation restricted to verified Super Admin only)
  const effectiveRole: UserRole = (currentUser?.role === 'Super Admin' && simulationRole)
    ? simulationRole
    : (currentUser?.role || 'Client');

  const [activeTab, setActiveTabState] = useState<string>('dashboard');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [currentDraft, setCurrentDraftState] = useState<SavedDraft | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<SyncStatus>(null);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<VersionConflictState | null>(null);
  const [surveyConflictReview, setSurveyConflictReview] = useState<SurveyConflictReviewState | null>(null);
  
  const [savedDrafts, setSavedDraftsState] = useState<SavedDraft[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutosavingRef = useRef<boolean>(false);
  const activeUserIdRef = useRef<string | null>(null);
  const currentDraftRef = useRef<SavedDraft | null>(null);
  const savedDraftsRef = useRef<SavedDraft[]>([]);
  const editSeqByDraftRef = useRef<Record<string, number>>({});
  const inFlightSaveByDraftRef = useRef<Record<string, Promise<SavedDraft | null> | undefined>>({});
  const queuedSaveByDraftRef = useRef<Record<string, boolean>>({});

  const setCurrentDraft = (
    updater: SavedDraft | null | ((prev: SavedDraft | null) => SavedDraft | null)
  ) => {
    setCurrentDraftState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      currentDraftRef.current = next;
      return next;
    });
  };

  const setSavedDrafts = (
    updater: SavedDraft[] | ((prev: SavedDraft[]) => SavedDraft[])
  ) => {
    setSavedDraftsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      savedDraftsRef.current = next;
      return next;
    });
  };

  const hasUnsavedChanges = Boolean(
    currentDraft &&
      (currentDraft.unsynced ||
        currentDraft.needsRemoteCreate ||
        autosaveStatus === 'Saved on this device' ||
        autosaveStatus === 'Syncing' ||
        autosaveStatus === 'Save failed')
  );

  // Warn before closing or refreshing browser tab when unsynced changes exist
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const active = currentDraftRef.current;
      if (
        active &&
        (active.unsynced ||
          active.needsRemoteCreate ||
          autosaveStatus === 'Saved on this device' ||
          autosaveStatus === 'Syncing' ||
          autosaveStatus === 'Save failed')
      ) {
        saveUserDraftsToDisk(savedDraftsRef.current, currentUser);
        e.preventDefault();
        e.returnValue = 'You have unsynced deed changes on this device.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autosaveStatus, currentUser]);

  /**
   * Clear all sensitive in-memory workspace state on logout or account switch
   */
  const clearSensitiveWorkspaceState = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    isAutosavingRef.current = false;
    editSeqByDraftRef.current = {};
    inFlightSaveByDraftRef.current = {};
    queuedSaveByDraftRef.current = {};
    setAutosaveStatus(null);
    setLastSaveError(null);
    setVersionConflict(null);
    setSurveyConflictReview(null);
    setSavedDrafts([]);
    setCurrentDraft(null);
    setClients([]);
    setAuditLogs([]);
    setUsersList([]);
    setUserProfiles([]);
    setNotifications([]);
    setSimulationRole(null);
    setActiveStep(1);
    localStorage.removeItem('unikorn360_clients');
    localStorage.removeItem('unikorn360_saved_drafts');
    localStorage.removeItem('unikorn360_saved_drafts_anonymous');
  };

  /**
   * User-scoped storage helpers for strict isolation across accounts
   */
  const getUserDraftsStorageKey = (user?: UserAccount | null): string | null => {
    const targetUser = user !== undefined ? user : currentUser;
    const uid = targetUser?.id || targetUser?.uid;
    if (uid) {
      return `unikorn360_saved_drafts_${uid}`;
    }
    const email = targetUser?.email;
    if (email) {
      return `unikorn360_saved_drafts_${email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
    return null;
  };

  const getUserClientsStorageKey = (user?: UserAccount | null): string | null => {
    const targetUser = user !== undefined ? user : currentUser;
    const uid = targetUser?.id || targetUser?.uid;
    if (uid) {
      return `unikorn360_clients_${uid}`;
    }
    const email = targetUser?.email;
    if (email) {
      return `unikorn360_clients_${email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }
    return null;
  };

  const loadLocalDraftsForUser = (user?: UserAccount | null): SavedDraft[] => {
    const key = getUserDraftsStorageKey(user);
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((d: any) => d && d.id);
        }
      }
    } catch (e) {
      console.warn('Failed to read user drafts from localStorage:', e);
    }
    return [];
  };

  const saveUserDraftsToDisk = (draftsList: SavedDraft[], user?: UserAccount | null): boolean => {
    const key = getUserDraftsStorageKey(user);
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(draftsList));
      return true;
    } catch (e) {
      console.error('Failed to write drafts to user storage key', key, e);
      return false;
    }
  };

  const loadLocalClientsForUser = (user?: UserAccount | null): ClientProfile[] => {
    const key = getUserClientsStorageKey(user);
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: any) => c && c.id);
        }
      }
    } catch (e) {
      console.warn('Failed to read user clients from localStorage:', e);
    }
    return [];
  };

  const saveUserClientsToDisk = (clientsList: ClientProfile[], user?: UserAccount | null): boolean => {
    const key = getUserClientsStorageKey(user);
    if (!key) return false;
    try {
      localStorage.removeItem('unikorn360_clients');
      localStorage.setItem(key, JSON.stringify(clientsList));
      return true;
    } catch (e) {
      console.error('Failed to write clients to user storage key', key, e);
      return false;
    }
  };

  /**
   * Safe asynchronous Supabase session token retrieval for API headers.
   * Never sends browser-controlled identity or role headers (x-user-id, x-user-email, x-user-role).
   */
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    let token = '';
    try {
      const session = await getActiveSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    } catch (e) {
      console.warn('Notice: Failed to fetch active Supabase session token:', e);
    }

    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  // Sync audit logs from protected backend endpoint
  const refreshAuditLogs = async () => {
    if (!currentUser || !['Super Admin', 'Admin', 'Auditor'].includes(currentUser.role)) {
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit-logs', { headers });
      if (res.ok) {
        const logs = await res.json();
        if (Array.isArray(logs)) {
          setAuditLogs(logs);
        }
      }
    } catch (e) {
      console.warn('Notice: Audit logs fetch handled gracefully.');
    }
  };

  const refreshUserProfiles = async (): Promise<UserProfile[]> => {
    try {
      const profiles = await fetchUserProfilesFromSupabase();
      if (profiles && profiles.length > 0) {
        setUserProfiles(profiles);
        const mapped: UserAccount[] = profiles.map((p: UserProfile) => ({
          id: p.id,
          uid: p.id,
          name: p.full_name,
          email: p.email,
          phone: '',
          organization: p.organization || 'Independent Workspace',
          role: p.role,
          status: (
            p.status === 'suspended' ? 'Suspended' :
            p.status === 'deleted' ? 'Deleted' :
            p.status === 'pending' ? 'Pending Approval' : 'Approved'
          ) as any,
          photo: p.avatar_url || '',
          createdAt: p.created_at
        }));
        setUsersList(mapped);
        return profiles;
      }
    } catch (e) {
      console.warn('Notice: Supabase user_profiles query notice:', e);
    }
    return [];
  };

  const refreshUsersList = async () => {
    try {
      // 1. Query Supabase public.user_profiles / backend first (Source of Truth)
      const profiles = await refreshUserProfiles();
      if (profiles && profiles.length > 0) {
        return;
      }

      // 2. Query backend API with verified auth headers
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/auth/users', { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: UserAccount[] = data.map((u: any) => ({
              id: u.id,
              uid: u.id,
              name: u.name,
              email: u.email,
              phone: u.phone || '',
              organization: u.organization || 'Independent Workspace',
              role: u.role as UserRole,
              status: u.status as any,
              photo: u.photo || '',
              createdAt: u.createdAt || u.created_at || new Date().toISOString()
            }));
            setUsersList(mapped);
            return;
          }
        }
      } catch (err) {
        // Backend users endpoint is restricted for non-admin roles
      }
    } catch (e) {
      console.warn('Notice: Users list fetch handled gracefully:', e);
    }
  };

  // Sync everything on user role / change
  const syncDatabase = async () => {
    if (!currentUser || currentUser.status !== 'Approved') {
      return;
    }
    try {
      await refreshAuditLogs();
      await refreshUsersList();

      const headers = await getAuthHeaders();

      // Sync Documents with remote backend API while preserving unsynced local changes (offline recovery)
      try {
        const docRes = await fetch('/api/documents', { headers });
        if (docRes.ok) {
          const remoteDocsRaw = await docRes.json();
          const remoteDocs: SavedDraft[] = Array.isArray(remoteDocsRaw)
            ? remoteDocsRaw.filter((d: any, index: number, self: any[]) => d && d.id && self.findIndex((t: any) => t.id === d.id) === index)
            : [];

          const localDrafts = loadLocalDraftsForUser(currentUser);
          const localById = new Map<string, SavedDraft>();
          for (const ld of localDrafts) {
            if (ld && ld.id) {
              localById.set(ld.id, ld);
            }
          }

          const mergedDocs: SavedDraft[] = remoteDocs.map(remoteDoc => {
            const localMatch = localById.get(remoteDoc.id);
            if (localMatch && (localMatch.unsynced || localMatch.needsRemoteCreate)) {
              const remoteRev = Number(remoteDoc.revision || 1);
              const localBaseRev = Number(localMatch.revision || 1);
              if (remoteRev > localBaseRev) {
                // Server advanced while local draft had unsynced offline edits -> surface version conflict
                setVersionConflict({
                  draftId: remoteDoc.id,
                  message: `Document ${remoteDoc.docNo} was updated on the server (rev ${remoteRev}) while this device had unsynced local changes (base rev ${localBaseRev}).`,
                  serverDocument: remoteDoc,
                  currentRevision: remoteRev,
                  localDraft: localMatch
                });
              }
              return {
                ...localMatch,
                docNo: remoteDoc.docNo || localMatch.docNo,
                needsRemoteCreate: false,
                unsynced: true
              };
            }
            return {
              ...remoteDoc,
              unsynced: false,
              needsRemoteCreate: false
            };
          });

          // Preserve any offline-created drafts not yet present on the server
          for (const ld of localDrafts) {
            if (ld && ld.id && (ld.needsRemoteCreate || ld.unsynced) && !mergedDocs.some(m => m.id === ld.id)) {
              mergedDocs.unshift(ld);
            }
          }

          setSavedDrafts(mergedDocs);
          saveUserDraftsToDisk(mergedDocs, currentUser);
          setCurrentDraft(prev => {
            if (!prev) return null;
            const found = mergedDocs.find(d => d.id === prev.id);
            if (!found) return null;
            if (found.unsynced || found.needsRemoteCreate) {
              setAutosaveStatus(found.lastSyncError ? 'Save failed' : 'Saved on this device');
            }
            return found;
          });
        } else {
          console.warn(`Remote /api/documents returned ${docRes.status}.`);
        }
      } catch (err) {
        console.warn('Network failure accessing /api/documents:', err);
      }

      // Sync Clients with remote backend API — never upload cached or dummy clients when server returns empty
      try {
        const clientRes = await fetch('/api/clients', { headers });
        if (clientRes.ok) {
          const data = await clientRes.json();
          const remoteClients: ClientProfile[] = Array.isArray(data?.clients)
            ? data.clients.filter((c: any, index: number, self: any[]) => c && c.id && self.findIndex((t: any) => t.id === c.id) === index)
            : [];
          setClients(remoteClients);
          saveUserClientsToDisk(remoteClients, currentUser);
        }
      } catch (err) {
        console.warn('Client sync network error:', err);
      }
    } catch (e) {
      console.warn('Notice: Database sync handled gracefully:', e);
    }
  };

  /**
   * Explicit Supabase Authentication Initialization Flow
   * (Verified Supabase session + server profile is the ONLY active authority)
   */
  useEffect(() => {
    let isMounted = true;

    const clearUnverifiedAuthCache = () => {
      localStorage.removeItem('unikorn_authenticated_user');
      localStorage.removeItem('unikorn_simulation_role');
      localStorage.removeItem('unikorn360_clients');
      localStorage.removeItem('unikorn360_saved_drafts');
      localStorage.removeItem('unikorn360_saved_drafts_anonymous');
      if (!isSupabaseConfigured) {
        localStorage.removeItem('deedos360_supabase_auth_token');
      }
    };

    const applyAuthenticatedSession = async (sessionUser: any) => {
      const initialProfile = mapSupabaseUserToUserAccount(sessionUser);
      if (activeUserIdRef.current !== initialProfile.id) {
        clearSensitiveWorkspaceState();
        activeUserIdRef.current = initialProfile.id;
      }

      const userDrafts = loadLocalDraftsForUser(initialProfile);
      const userClients = loadLocalClientsForUser(initialProfile);
      const serverProfile = await upsertUserProfileToSupabase(sessionUser, {
        documentCount: userDrafts.length
      });
      if (!isMounted) return;
      const resolvedProfile = mapSupabaseUserToUserAccount(sessionUser, serverProfile);
      setCurrentUser(resolvedProfile);

      if (resolvedProfile.status === 'Approved') {
        setSavedDrafts(userDrafts);
        setClients(userClients);
        refreshUserProfiles().catch(err => console.warn('Profile refresh warning:', err));
      } else {
        clearSensitiveWorkspaceState();
      }
    };

    const initializeSupabaseAuth = async () => {
      try {
        clearUnverifiedAuthCache();
        const session = await getActiveSession();
        if (isMounted) {
          if (session?.user) {
            await applyAuthenticatedSession(session.user);
          } else {
            activeUserIdRef.current = null;
            clearSensitiveWorkspaceState();
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.warn('Auth initialization getSession warning:', err);
        if (isMounted) {
          activeUserIdRef.current = null;
          clearUnverifiedAuthCache();
          clearSensitiveWorkspaceState();
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeSupabaseAuth();

    // Step 2: Subscribe to Supabase Auth State Changes (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          await applyAuthenticatedSession(session.user);
        } else {
          activeUserIdRef.current = null;
          clearUnverifiedAuthCache();
          clearSensitiveWorkspaceState();
          setCurrentUser(null);
        }
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        activeUserIdRef.current = null;
        clearSensitiveWorkspaceState();
        setCurrentUser(null);
        clearUnverifiedAuthCache();
        localStorage.removeItem('deedos360_supabase_auth_token');
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sync database only after auth initialization is complete and an approved user exists
  useEffect(() => {
    if (!authLoading && currentUser && currentUser.status === 'Approved') {
      syncDatabase().catch(err => {
        console.warn('Background database synchronization notice:', err);
      });
    }
  }, [authLoading, currentUser, effectiveRole]);

  // Handle active tab protection and defaults based on role change
  useEffect(() => {
    if (currentUser && currentUser.status === 'Approved') {
      const allowed = getRoleAllowedTabs(effectiveRole);
      // If active tab is not allowed for the new role, switch to the first allowed tab
      if (!allowed.includes(activeTab)) {
        setActiveTab(allowed[0] || 'dashboard');
      }
    }
  }, [effectiveRole, currentUser]);

  // Validation function to track completion status for each step
  const getStepCompletionStates = (state: DeedWizardState): boolean[] => {
    const states = Array(11).fill(false);
    
    try {
      const deedDef = resolveDeedType(state.documentType);

      // Step 1: Doc Type (must be selected and have an available template)
      states[0] = Boolean(state.documentType && deedDef?.templateAvailable);

      // Step 2: Parties
      const rolePartition = deedDef
        ? partitionPartiesForDeedType(state.parties || [], deedDef.code)
        : { grantors: [], grantees: [] };
      const hasValidRoles = deedDef
        ? rolePartition.grantors.length > 0 && rolePartition.grantees.length > 0
        : state.parties.length >= 2;
      states[1] = hasValidRoles && state.parties.length >= 2 && state.parties.every(party => 
        party.name?.trim() && 
        party.fatherName?.trim() && 
        party.age >= 18 && 
        party.aadhaar?.trim() && 
        party.pan?.trim() && 
        party.phone?.trim() && 
        party.address?.trim()
      );

      // Step 3: Property Details
      states[2] = !!(
        state.property.district && 
        state.property.registrationDistrict && 
        state.property.taluk && 
        state.property.village && 
        state.property.sro && 
        state.property.doorNo?.trim()
      );

      // Step 4: Survey Details
      const surveysToValidate = state.surveys && state.surveys.length > 0 ? state.surveys : [state.survey];
      states[3] = surveysToValidate.length > 0 && surveysToValidate.every(s => 
        s.surveyNo?.trim() && 
        s.subDivision?.trim() && 
        s.pattaNo?.trim() && 
        s.chittaRef?.trim()
      );

      // Step 5: Extent Details
      const totalExtent = state.extent.totalExtent || state.extent.sqft;
      states[4] = !!(
        totalExtent > 0 && 
        state.extent.eastWest?.trim() && 
        state.extent.northSouth?.trim()
      );

      // Step 6: Boundary Details
      states[5] = !!(
        state.boundary.east?.trim() && 
        state.boundary.west?.trim() && 
        state.boundary.north?.trim() && 
        state.boundary.south?.trim()
      );

      // Step 7: Ownership History
      states[6] = !!(
        state.ownershipHistory.parentDocNo?.trim() && 
        state.ownershipHistory.parentDocYear?.trim() && 
        state.ownershipHistory.parentDocDate?.trim() && 
        state.ownershipHistory.parentDocSRO?.trim() && 
        state.ownershipHistory.parentDocDate?.trim() && 
        state.ownershipHistory.priorOwners?.trim()
      );

      // Step 8: Transaction Details
      if (!deedDef || !deedDef.templateAvailable) {
        states[7] = false;
      } else if (deedDef.requiresMonetaryConsideration) {
        states[7] = !!(
          state.transaction.considerationAmount > 0 &&
          (!deedDef.requiresPaymentReference || state.transaction.paymentRefNo?.trim())
        );
      } else {
        const mustBeZero = deedDef.code === 'GIFT' || deedDef.code === 'SETTLEMENT' || deedDef.code === 'POA';
        states[7] = !mustBeZero || (state.transaction.considerationAmount || 0) === 0;
      }

      // Step 9: Witness Details
      states[8] = state.witnesses.length >= 2 && state.witnesses.every(w => 
        w.name?.trim() && 
        w.fatherName?.trim() && 
        w.age >= 18 && 
        (w.idProof?.trim() || w.aadhaar?.trim()) && 
        w.address?.trim()
      );

      // Step 10: Selected Clauses
      states[9] = state.selectedClauses.length > 0;

      // Step 11: Review is always complete if we reached here
      states[10] = true;

    } catch (err) {
      console.error("Step validation crashed", err);
    }

    return states;
  };

  // Calculate overall completeness percentage based on 11 steps
  const calculateProgress = (state: DeedWizardState): number => {
    const states = getStepCompletionStates(state);
    const completed = states.filter(Boolean).length;
    return Math.round((completed / 11) * 100);
  };

  // Save drafts when changed
  const saveAllDraftsToDisk = (draftsList: SavedDraft[]) => {
    return saveUserDraftsToDisk(draftsList, currentUser);
  };

  // Supabase Auth with Google OAuth (never grants automatic Super Admin when unconfigured)
  const loginWithGoogleHandler = async () => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: 'Authentication service is unavailable: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured in the environment.'
      };
    }

    try {
      await signInWithGoogleOAuth();
      return { success: true, message: 'Redirecting to Google Sign-In via Supabase...' };
    } catch (err: any) {
      console.error('Google login error:', err);
      return { success: false, message: err?.message || 'Google Authentication failed.' };
    }
  };

  const logoutUser = async () => {
    try {
      await signOutSupabase();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    activeUserIdRef.current = null;
    clearSensitiveWorkspaceState();
    setCurrentUser(null);
    localStorage.removeItem('unikorn_authenticated_user');
    localStorage.removeItem('unikorn_simulation_role');
    localStorage.removeItem('deedos360_supabase_auth_token');
    setActiveTab('dashboard');
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    const existing = userProfiles.find(u => u.id === userId) || usersList.find(u => u.id === userId);
    const oldRole = existing?.role;

    await updateUserProfileRoleInSupabase(
      userId, 
      newRole, 
      currentUser?.id || '', 
      currentUser?.email || '',
      oldRole
    );

    setUserProfiles(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, last_activity: new Date().toISOString() } : u));
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    if (currentUser && (currentUser.id === userId || currentUser.uid === userId)) {
      const updated = { ...currentUser, role: newRole };
      setCurrentUser(updated);
    }
  };

  const updateUserStatus = async (userId: string, newStatus: 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted' | 'active' | 'suspended' | 'pending' | 'deleted') => {
    const existing = userProfiles.find(u => u.id === userId) || usersList.find(u => u.id === userId);
    const oldStatus = existing?.status;
    const raw = String(newStatus).toLowerCase();
    const canonicalProfileStatus: 'active' | 'suspended' | 'pending' | 'deleted' =
      raw === 'suspended' ? 'suspended' :
      raw === 'deleted' ? 'deleted' :
      (raw === 'pending' || raw === 'pending approval') ? 'pending' : 'active';
    const canonicalAccountStatus: 'Approved' | 'Pending Approval' | 'Suspended' | 'Deleted' =
      canonicalProfileStatus === 'suspended' ? 'Suspended' :
      canonicalProfileStatus === 'deleted' ? 'Deleted' :
      canonicalProfileStatus === 'pending' ? 'Pending Approval' : 'Approved';

    await updateUserProfileStatusInSupabase(
      userId, 
      canonicalProfileStatus, 
      currentUser?.id || '', 
      currentUser?.email || '',
      oldStatus
    );

    setUserProfiles(prev => prev.map(u => u.id === userId ? { ...u, status: canonicalProfileStatus, last_activity: new Date().toISOString() } : u));
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, status: canonicalAccountStatus } : u));
    if (currentUser && (currentUser.id === userId || currentUser.uid === userId)) {
      const updated = { ...currentUser, status: canonicalAccountStatus };
      setCurrentUser(updated);
    }
  };

  // Populate Default Dummies
  const loadDefaultDummies = () => {
    const defaultState = createDefaultState('SALE', 'SALE_METRO');
    const dft1State: DeedWizardState = {
      ...defaultState,
      selectedClauses: ['cl1', 'cl2', 'cl3', 'cl4', 'cl5']
    };
    const dft2State: DeedWizardState = {
      ...defaultState,
      selectedClauses: ['cl1', 'cl2', 'cl3', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11']
    };

    const finalDummies: SavedDraft[] = DRAFT_DEEDS.map((deed: any) => {
      let docState = defaultState;
      if (deed.id === 'dft1') docState = dft1State;
      if (deed.id === 'dft2') docState = dft2State;
      
      return {
        id: deed.id,
        docNo: deed.docNo,
        docType: deed.docType,
        subType: deed.subType,
        partiesCount: deed.partiesCount,
        propertyAddress: deed.propertyAddress,
        consideration: deed.consideration,
        status: deed.status as DraftStatus,
        writer: deed.writer,
        progress: deed.progress,
        createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
        modifiedAt: new Date(deed.date).toISOString(),
        createdBy: currentUser?.email || 'system',
        state: docState
      };
    });

    setSavedDrafts(finalDummies);
    saveAllDraftsToDisk(finalDummies);
  };

  // Synchronized, non-stale per-draft server persistence engine
  const syncDraftToServer = async (
    targetDraftId?: string,
    extraOptions?: {
      statusOverride?: DraftStatus;
      conflictReviewAcknowledged?: boolean;
      conflictReviewNotes?: string;
    }
  ): Promise<SavedDraft | null> => {
    const draftId = targetDraftId || currentDraftRef.current?.id;
    if (!draftId) return null;

    const expectedUserId = activeUserIdRef.current;

    // If a save is already in-flight for this draft, mark a follow-up save in the queue and await the active one
    if (inFlightSaveByDraftRef.current[draftId]) {
      queuedSaveByDraftRef.current[draftId] = true;
      await inFlightSaveByDraftRef.current[draftId];
    }

    const executeSave = async (): Promise<SavedDraft | null> => {
      // Always read the freshest draft state from refs (never a stale closure)
      const latestDraft =
        currentDraftRef.current?.id === draftId
          ? currentDraftRef.current
          : savedDraftsRef.current.find(d => d.id === draftId) || null;

      if (!latestDraft) return null;
      if (activeUserIdRef.current !== expectedUserId) return null;

      const seqAtStart = editSeqByDraftRef.current[draftId] || 0;
      isAutosavingRef.current = true;
      if (currentDraftRef.current?.id === draftId) {
        setAutosaveStatus('Syncing');
      }

      const updatedProgress = calculateProgress(latestDraft.state);
      const nextStatus: DraftStatus =
        extraOptions?.statusOverride ||
        latestDraft.status;

      const payloadDraft: SavedDraft = {
        ...latestDraft,
        progress: updatedProgress,
        status: nextStatus,
        modifiedAt: new Date().toISOString(),
        state: {
          ...latestDraft.state,
          ...(extraOptions?.conflictReviewAcknowledged !== undefined
            ? { conflictReviewAcknowledged: extraOptions.conflictReviewAcknowledged }
            : {}),
          ...(extraOptions?.conflictReviewNotes !== undefined
            ? { conflictReviewNotes: extraOptions.conflictReviewNotes }
            : {})
        },
        ...(extraOptions?.conflictReviewAcknowledged !== undefined
          ? { conflictReviewAcknowledged: extraOptions.conflictReviewAcknowledged }
          : {}),
        ...(extraOptions?.conflictReviewNotes !== undefined
          ? { conflictReviewNotes: extraOptions.conflictReviewNotes }
          : {})
      };

      try {
        const headers = await getAuthHeaders();
        const isCreate = Boolean(latestDraft.needsRemoteCreate);
        const endpoint = isCreate ? '/api/documents' : `/api/documents/${draftId}`;
        const method = isCreate ? 'POST' : 'PUT';

        const requestBody = isCreate
          ? (() => {
              const { docNo: _omitProvisional, unsynced: _u, needsRemoteCreate: _n, lastSyncError: _e, ...rest } = payloadDraft;
              return rest;
            })()
          : {
              ...payloadDraft,
              expectedRevision: latestDraft.revision
            };

        const res = await fetch(endpoint, {
          method,
          headers,
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error || `Server save failed (HTTP ${res.status})`;

          // If POST returned 409 because the document was already created on server, switch needsRemoteCreate off and retry via PUT
          if (isCreate && res.status === 409 && !errData?.code) {
            setSavedDrafts(prev =>
              prev.map(d => (d.id === draftId ? { ...d, needsRemoteCreate: false } : d))
            );
            if (currentDraftRef.current?.id === draftId) {
              setCurrentDraft(prev => (prev ? { ...prev, needsRemoteCreate: false } : null));
            }
          }

          if (res.status === 409 && errData?.code === 'VERSION_CONFLICT') {
            setVersionConflict({
              draftId,
              message: errMsg,
              serverDocument: errData?.currentDocument,
              currentRevision: errData?.currentRevision,
              localDraft: payloadDraft
            });
          } else if (res.status === 409 && errData?.code === 'SURVEY_CONFLICT_REQUIRES_REVIEW') {
            setSurveyConflictReview({
              draftId,
              message: errMsg,
              conflicts: Array.isArray(errData?.conflicts) ? errData.conflicts : []
            });
          }

          if (activeUserIdRef.current === expectedUserId) {
            const failedDraft: SavedDraft = {
              ...latestDraft,
              progress: updatedProgress,
              unsynced: true,
              lastSyncError: errMsg
            };
            if (currentDraftRef.current?.id === draftId) {
              setCurrentDraft(failedDraft);
              setAutosaveStatus('Save failed');
              setLastSaveError(errMsg);
            }
            setSavedDrafts(prev => {
              const list = prev.map(d => (d.id === draftId ? failedDraft : d));
              saveAllDraftsToDisk(list);
              return list;
            });
          }
          isAutosavingRef.current = false;
          return null;
        }

        const data = await res.json().catch(() => null);
        const serverDoc: SavedDraft | undefined = data?.document;

        if (activeUserIdRef.current !== expectedUserId) {
          isAutosavingRef.current = false;
          return null;
        }

        const currentSeqNow = editSeqByDraftRef.current[draftId] || 0;
        const hadNewerLocalEditsDuringFlight = currentSeqNow > seqAtStart;

        const newestLocalNow =
          currentDraftRef.current?.id === draftId
            ? currentDraftRef.current
            : savedDraftsRef.current.find(d => d.id === draftId) || payloadDraft;

        const syncedDraft: SavedDraft = hadNewerLocalEditsDuringFlight
          ? {
              ...newestLocalNow,
              docNo: serverDoc?.docNo || newestLocalNow.docNo,
              revision: serverDoc?.revision ?? newestLocalNow.revision,
              version: serverDoc?.version ?? newestLocalNow.version,
              revisionHistory: serverDoc?.revisionHistory ?? newestLocalNow.revisionHistory,
              needsRemoteCreate: false,
              unsynced: true,
              lastSyncError: undefined
            }
          : {
              ...payloadDraft,
              ...(serverDoc || {}),
              docNo: serverDoc?.docNo || payloadDraft.docNo,
              revision: serverDoc?.revision ?? payloadDraft.revision,
              version: serverDoc?.version ?? payloadDraft.version,
              revisionHistory: serverDoc?.revisionHistory ?? payloadDraft.revisionHistory,
              state: {
                ...payloadDraft.state,
                ...(serverDoc?.state || {}),
                parties: payloadDraft.state.parties,
                witnesses: payloadDraft.state.witnesses
              },
              needsRemoteCreate: false,
              unsynced: false,
              lastSyncError: undefined,
              lastSyncedAt: new Date().toISOString()
            };

        if (currentDraftRef.current?.id === draftId) {
          setCurrentDraft(syncedDraft);
          setLastSaveError(null);
          setAutosaveStatus(hadNewerLocalEditsDuringFlight ? 'Saved on this device' : 'Saved on server');
        }

        setSavedDrafts(prev => {
          const list = prev.map(d => (d.id === draftId ? syncedDraft : d));
          saveAllDraftsToDisk(list);
          return list;
        });

        isAutosavingRef.current = false;
        return syncedDraft;
      } catch (err: any) {
        const errMsg = err?.message || 'Network error while syncing with server';
        console.error('Draft sync failed, retaining unsynced local changes:', err);

        if (activeUserIdRef.current === expectedUserId) {
          const failedDraft: SavedDraft = {
            ...latestDraft,
            progress: updatedProgress,
            unsynced: true,
            lastSyncError: errMsg
          };
          if (currentDraftRef.current?.id === draftId) {
            setCurrentDraft(failedDraft);
            setAutosaveStatus('Save failed');
            setLastSaveError(errMsg);
          }
          setSavedDrafts(prev => {
            const list = prev.map(d => (d.id === draftId ? failedDraft : d));
            saveAllDraftsToDisk(list);
            return list;
          });
        }
        isAutosavingRef.current = false;
        return null;
      }
    };

    const runPromise = (async () => {
      let result = await executeSave();
      while (queuedSaveByDraftRef.current[draftId]) {
        queuedSaveByDraftRef.current[draftId] = false;
        result = await executeSave();
      }
      delete inFlightSaveByDraftRef.current[draftId];
      return result;
    })();

    inFlightSaveByDraftRef.current[draftId] = runPromise;
    return runPromise;
  };

  // Periodic autosave triggers every 30s if currentDraft has unsynced changes
  useEffect(() => {
    const timer = setInterval(() => {
      const active = currentDraftRef.current;
      if (
        active &&
        (active.unsynced || active.needsRemoteCreate) &&
        active.status !== 'Finalized' &&
        active.status !== 'Exported' &&
        !isAutosavingRef.current
      ) {
        syncDraftToServer(active.id);
      }
    }, 30000);
    
    return () => clearInterval(timer);
  }, []);

  // Trigger debounced server sync while immediately persisting to local device storage
  const triggerAutosaveDebounced = (draftId: string) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      syncDraftToServer(draftId);
    }, 1200);
  };

  const setActiveTab = (nextTab: string) => {
    if (autosaveTimerRef.current && currentDraftRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      syncDraftToServer(currentDraftRef.current.id);
    }
    setActiveTabState(nextTab);
  };

  // CRUD: Create Draft
  const createDraft = (docType: string, subType: string): SavedDraft => {
    // Flush any pending save on previous draft before switching
    if (autosaveTimerRef.current && currentDraftRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      syncDraftToServer(currentDraftRef.current.id);
    }

    const uniqueId = generateClientSideUuid();
    const provisionalRef = `DEED/${new Date().getFullYear()}/PENDING`;
    const canonicalCode = normalizeDeedCode(docType) || docType;
    const deedDef = resolveDeedType(canonicalCode);

    const docTypeLabel = getDeedDisplayName(canonicalCode);

    const subTypeLabel = subType === 'SALE_METRO' ? 'Sale in Metro Area'
      : subType === 'SALE_PANCHAYAT' ? 'Sale in Panchayat Area'
      : subType === 'GIFT_FAMILY' ? 'Gift to Family Member'
      : subType === 'SETTLE_FAMILY' ? 'Family Settlement Deed'
      : subType === 'LEASE_RES' ? 'Residential Lease'
      : subType || 'Standard Subtype';

    const newState = createDefaultState(canonicalCode, subType);
    const defaultConsideration = !deedDef?.requiresMonetaryConsideration
      ? 0
      : canonicalCode === 'LEASE'
      ? 25000
      : 500000;

    const newDraft: SavedDraft = {
      id: uniqueId,
      docNo: provisionalRef,
      docType: docTypeLabel,
      subType: subTypeLabel,
      partiesCount: 2,
      propertyAddress: 'No Address Specified Yet',
      consideration: defaultConsideration,
      status: 'Draft',
      writer: `Drafted by ${currentUser?.name || currentUser?.email || 'Licensed Writer'}`,
      progress: 0,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      createdBy: currentUser?.email || 'unknown',
      createdByUserId: currentUser?.id,
      createdByEmail: currentUser?.email,
      revision: 1,
      version: 1,
      revisionHistory: [],
      unsynced: true,
      needsRemoteCreate: true,
      state: newState
    };

    editSeqByDraftRef.current[uniqueId] = 1;
    setVersionConflict(null);
    setSurveyConflictReview(null);
    setLastSaveError(null);
    setAutosaveStatus('Saved on this device');

    setSavedDrafts(prev => {
      const list = [newDraft, ...prev];
      saveAllDraftsToDisk(list);
      return list;
    });

    setCurrentDraft(newDraft);
    setActiveStep(1);
    setActiveTabState('wizard');

    // Immediately initiate server creation via syncDraftToServer
    syncDraftToServer(uniqueId);

    const newNotif: SystemNotification = {
      id: `n-${Date.now()}`,
      title: 'New Draft Created',
      message: `Started new ${docTypeLabel} draft. Complete all wizard steps to generate registration deed.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);

    return newDraft;
  };

  // CRUD: Load existing draft (safely flushes any pending autosave on previous draft)
  const loadDraft = (id: string) => {
    if (autosaveTimerRef.current && currentDraftRef.current && currentDraftRef.current.id !== id) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      syncDraftToServer(currentDraftRef.current.id);
    }

    const draft = savedDraftsRef.current.find(d => d.id === id) || savedDrafts.find(d => d.id === id);
    if (draft) {
      setVersionConflict(null);
      setSurveyConflictReview(null);
      setCurrentDraft(draft);
      if (draft.unsynced || draft.needsRemoteCreate) {
        setAutosaveStatus(draft.lastSyncError ? 'Save failed' : 'Saved on this device');
        setLastSaveError(draft.lastSyncError || null);
      } else {
        setAutosaveStatus('Saved on server');
        setLastSaveError(null);
      }
      setActiveStep(1);
      setActiveTabState('wizard');
    } else {
      const errNotif: SystemNotification = {
        id: `n-${Date.now()}`,
        title: 'Draft Not Found',
        message: `Draft with ID ${id} could not be found in your workspace.`,
        type: 'error',
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [errNotif, ...prev]);
    }
  };

  // CRUD: Update state of current draft
  const updateCurrentDraftState = (newState: DeedWizardState) => {
    const active = currentDraftRef.current;
    if (!active) return;

    // Prevent ordinary edits to Finalized or Exported records on the client as well as server
    if (active.status === 'Finalized' || active.status === 'Exported') {
      setLastSaveError('REGISTRY LOCK: Finalized documents are immutable. Create a new revision to make corrections.');
      setAutosaveStatus('Save failed');
      return;
    }

    const partiesCount = Array.isArray(newState.parties) ? newState.parties.length : 0;

    let propertyAddress = 'No Address Specified Yet';
    if (newState.property?.doorNo || newState.property?.village) {
      propertyAddress = `${newState.property.doorNo || ''}, ${newState.property.village || ''}, ${newState.property.taluk || ''} Taluk, ${newState.property.district || ''}`.replace(/^,\s*/, '');
    }

    const consideration = newState.transaction?.considerationAmount || 0;
    const updatedProgress = calculateProgress(newState);

    editSeqByDraftRef.current[active.id] = (editSeqByDraftRef.current[active.id] || 0) + 1;

    const updatedDraft: SavedDraft = {
      ...active,
      partiesCount,
      propertyAddress,
      consideration,
      progress: updatedProgress,
      state: newState,
      unsynced: true,
      modifiedAt: new Date().toISOString()
    };

    // 1. Immediately persist to local device state and localStorage -> 'Saved on this device'
    setCurrentDraft(updatedDraft);
    setSavedDrafts(prev => {
      const list = prev.map(d => (d.id === updatedDraft.id ? updatedDraft : d));
      saveAllDraftsToDisk(list);
      return list;
    });
    setAutosaveStatus('Saved on this device');

    // 2. Schedule debounced server sync -> transitions to 'Syncing' then 'Saved on server' or 'Save failed'
    triggerAutosaveDebounced(updatedDraft.id);
  };

  // CRUD: Manual save draft
  const saveDraftManual = async () => {
    const active = currentDraftRef.current;
    if (!active) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const updatedProgress = calculateProgress(active.state);
    const nextStatus: DraftStatus =
      active.status === 'Draft' && updatedProgress > 50
        ? 'In Progress'
        : active.status;

    const synced = await syncDraftToServer(active.id, { statusOverride: nextStatus });
    if (synced) {
      const newNotif: SystemNotification = {
        id: `n-${Date.now()}`,
        title: 'Saved on Server',
        message: `Deed draft ${synced.docNo} synced to server (rev ${synced.revision}, ${synced.progress}% completed).`,
        type: 'success',
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  // Retry syncing an unsynced or failed draft
  const retrySyncDraft = async (draftId?: string): Promise<boolean> => {
    const targetId = draftId || currentDraftRef.current?.id;
    if (!targetId) return false;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const synced = await syncDraftToServer(targetId);
    return Boolean(synced);
  };

  // Resolve a 409 optimistic concurrency conflict
  const resolveVersionConflict = async (resolution: 'keep-local' | 'use-server'): Promise<void> => {
    if (!versionConflict) return;
    const { draftId, serverDocument, currentRevision, localDraft } = versionConflict;

    if (resolution === 'use-server' && serverDocument) {
      const cleanServerDoc: SavedDraft = {
        ...serverDocument,
        unsynced: false,
        needsRemoteCreate: false,
        lastSyncError: undefined
      };
      setVersionConflict(null);
      setLastSaveError(null);
      if (currentDraftRef.current?.id === draftId) {
        setCurrentDraft(cleanServerDoc);
        setAutosaveStatus('Saved on server');
      }
      setSavedDrafts(prev => {
        const list = prev.map(d => (d.id === draftId ? cleanServerDoc : d));
        saveAllDraftsToDisk(list);
        return list;
      });
      return;
    }

    // 'keep-local': rebase local draft onto the server's latest revision and sync immediately
    const latestServerRev = currentRevision ?? serverDocument?.revision ?? (localDraft.revision || 1) + 1;
    const rebasedDraft: SavedDraft = {
      ...localDraft,
      revision: latestServerRev,
      docNo: serverDocument?.docNo || localDraft.docNo,
      unsynced: true,
      needsRemoteCreate: false
    };
    setVersionConflict(null);
    setLastSaveError(null);
    if (currentDraftRef.current?.id === draftId) {
      setCurrentDraft(rebasedDraft);
    }
    setSavedDrafts(prev => {
      const list = prev.map(d => (d.id === draftId ? rebasedDraft : d));
      saveAllDraftsToDisk(list);
      return list;
    });
    await syncDraftToServer(draftId);
  };

  const dismissSurveyConflictReview = () => {
    setSurveyConflictReview(null);
  };

  const acknowledgeSurveyConflictAndFinalize = async (
    draftIdOrNotes?: string,
    optionalNotes?: string
  ): Promise<boolean> => {
    let targetDraftId = currentDraftRef.current?.id;
    let notes = 'Transaction history reviewed and acknowledged by document writer.';

    if (optionalNotes !== undefined) {
      if (draftIdOrNotes) targetDraftId = draftIdOrNotes;
      notes = optionalNotes;
    } else if (draftIdOrNotes) {
      if (savedDraftsRef.current.some(d => d.id === draftIdOrNotes)) {
        targetDraftId = draftIdOrNotes;
      } else {
        notes = draftIdOrNotes;
      }
    }

    if (!targetDraftId) return false;
    setSurveyConflictReview(null);
    return updateDraftStatus(targetDraftId, 'Finalized', {
      conflictReviewAcknowledged: true,
      conflictReviewNotes: notes
    });
  };

  // Formal revision creation on a Finalized / Exported record (preserves revisionHistory on server)
  const createDraftRevision = async (id: string, notes?: string): Promise<SavedDraft | null> => {
    const draft = savedDraftsRef.current.find(d => d.id === id) || currentDraftRef.current;
    if (!draft) return null;

    setAutosaveStatus('Syncing');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/documents/${id}/revisions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          expectedRevision: draft.revision,
          revisionNotes: notes || `Revision initiated from ${draft.docNo}`
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error || `Failed to create revision (${res.status})`;
        setAutosaveStatus('Save failed');
        setLastSaveError(errMsg);
        return null;
      }

      const data = await res.json().catch(() => null);
      if (data?.document) {
        const revisedDoc: SavedDraft = {
          ...data.document,
          unsynced: false,
          needsRemoteCreate: false,
          lastSyncError: undefined
        };
        setCurrentDraft(prev => (prev && prev.id === id ? revisedDoc : prev));
        setSavedDrafts(prev => {
          const list = prev.map(d => (d.id === id ? revisedDoc : d));
          saveAllDraftsToDisk(list);
          return list;
        });
        setAutosaveStatus('Saved on server');
        setLastSaveError(null);
        return revisedDoc;
      }
      return null;
    } catch (err: any) {
      setAutosaveStatus('Save failed');
      setLastSaveError(err?.message || 'Failed to create revision');
      return null;
    }
  };

  // CRUD: Delete Draft
  const deleteDraft = async (id: string) => {
    const draftToDelete = savedDraftsRef.current.find(d => d.id === id) || savedDrafts.find(d => d.id === id);
    if (!draftToDelete) return;

    if (draftToDelete.status === 'Finalized' || draftToDelete.status === 'Exported') {
      const lockMsg = 'REGISTRY LOCK: Finalized documents are immutable and cannot be deleted.';
      setLastSaveError(lockMsg);
      setNotifications(prev => [
        {
          id: `n-${Date.now()}`,
          title: 'Deletion Blocked (Finalized Record)',
          message: lockMsg,
          type: 'error',
          timestamp: new Date().toISOString(),
          read: false
        },
        ...prev
      ]);
      return;
    }

    // If the draft exists on the server, require server confirmation before deleting locally
    if (!draftToDelete.needsRemoteCreate) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/documents/${id}`, {
          method: 'DELETE',
          headers
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error || `Failed to delete draft (${res.status})`;
          setLastSaveError(errMsg);
          setNotifications(prev => [
            {
              id: `n-${Date.now()}`,
              title: 'Delete Failed',
              message: errMsg,
              type: 'error',
              timestamp: new Date().toISOString(),
              read: false
            },
            ...prev
          ]);
          return;
        }
      } catch (e: any) {
        const errMsg = e?.message || 'Network failure while deleting draft on server.';
        setLastSaveError(errMsg);
        return;
      }
    }

    setSavedDrafts(prev => {
      const filtered = prev.filter(d => d.id !== id);
      saveAllDraftsToDisk(filtered);
      return filtered;
    });

    if (currentDraftRef.current?.id === id) {
      setCurrentDraft(null);
      setAutosaveStatus(null);
    }

    const newNotif: SystemNotification = {
      id: `n-${Date.now()}`,
      title: 'Draft Deleted',
      message: `Deed draft reference ${draftToDelete.docNo} was permanently removed.`,
      type: 'warning',
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // CRUD: Duplicate Draft
  const duplicateDraft = (id: string): SavedDraft => {
    const original = savedDraftsRef.current.find(d => d.id === id) || savedDrafts.find(d => d.id === id);
    if (!original) {
      throw new Error('Draft not found to duplicate');
    }

    const uniqueId = generateClientSideUuid();
    const provisionalRef = `DEED/${new Date().getFullYear()}/PENDING`;

    const duplicatedState: DeedWizardState = JSON.parse(JSON.stringify(original.state));
    delete duplicatedState.conflictReviewAcknowledged;
    delete duplicatedState.conflictReviewNotes;
    duplicatedState.version = 1;
    duplicatedState.revisionHistory = [];

    const duplicatedDraft: SavedDraft = {
      ...original,
      id: uniqueId,
      docNo: provisionalRef,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      createdBy: currentUser?.email || original.createdBy,
      createdByUserId: currentUser?.id || original.createdByUserId,
      createdByEmail: currentUser?.email || original.createdByEmail,
      revision: 1,
      version: 1,
      revisionHistory: [],
      unsynced: true,
      needsRemoteCreate: true,
      state: duplicatedState
    };

    editSeqByDraftRef.current[uniqueId] = 1;

    setSavedDrafts(prev => {
      const list = [duplicatedDraft, ...prev];
      saveAllDraftsToDisk(list);
      return list;
    });

    // Persist duplicate to server via syncDraftToServer (checks res.ok and retains unsynced on failure)
    syncDraftToServer(uniqueId).then(synced => {
      const newNotif: SystemNotification = {
        id: `n-${Date.now()}`,
        title: synced ? 'Draft Duplicated on Server' : 'Draft Duplicated (Saved on this device)',
        message: synced
          ? `Duplicated ${original.docNo} as ${synced.docNo}.`
          : `Duplicated ${original.docNo} locally. Server sync failed and can be retried.`,
        type: synced ? 'info' : 'warning',
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);
    });

    return duplicatedDraft;
  };

  // Update draft status — only transitions status after server acknowledgement (res.ok)
  const updateDraftStatus = async (
    id: string,
    status: DraftStatus,
    extraOptions?: { conflictReviewAcknowledged?: boolean; conflictReviewNotes?: string }
  ): Promise<boolean> => {
    const draft =
      (currentDraftRef.current?.id === id ? currentDraftRef.current : null) ||
      savedDraftsRef.current.find(d => d.id === id) ||
      savedDrafts.find(d => d.id === id);
    if (!draft) return false;

    if (
      (status === 'Finalized' || status === 'Generated' || status === 'Exported' || status === 'Approved') &&
      !isDeedTemplateAvailable(draft.state?.documentType || draft.docType)
    ) {
      setLastSaveError('Template unavailable: Generation, export, and finalization are blocked for this document type.');
      setAutosaveStatus('Save failed');
      return false;
    }

    if (autosaveTimerRef.current && currentDraftRef.current?.id === id) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const synced = await syncDraftToServer(id, {
      statusOverride: status,
      conflictReviewAcknowledged: extraOptions?.conflictReviewAcknowledged,
      conflictReviewNotes: extraOptions?.conflictReviewNotes
    });

    return Boolean(synced && synced.status === status);
  };

  // Client profiles management (user-scoped, persisted to backend)
  const addClient = async (client: ClientProfile) => {
    let savedClient: ClientProfile = {
      ...client,
      createdBy: currentUser?.email,
      createdByUserId: currentUser?.id,
      createdByEmail: currentUser?.email
    };

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers,
        body: JSON.stringify(savedClient)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.client) {
          savedClient = data.client;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Failed to save client (${res.status})`);
      }
    } catch (e) {
      console.error('Backend client creation failed:', e);
      throw e;
    }

    setClients(prev => {
      const list = [savedClient, ...prev];
      saveUserClientsToDisk(list, currentUser);
      return list;
    });
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      simulationRole,
      setSimulationRole,
      effectiveRole,
      authLoading,
      loginWithGoogleHandler,
      logoutUser,
      auditLogs,
      refreshAuditLogs,
      usersList,
      userProfiles,
      refreshUsersList,
      refreshUserProfiles,
      updateUserRole,
      updateUserStatus,
      syncDatabase,
      
      savedDrafts,
      currentDraft,
      activeStep,
      setActiveStep,
      autosaveStatus,
      lastSaveError,
      hasUnsavedChanges,
      versionConflict,
      surveyConflictReview,
      clients,
      notifications,
      activeTab,
      setActiveTab,
      
      createDraft,
      loadDraft,
      updateCurrentDraftState,
      saveDraftManual,
      retrySyncDraft,
      resolveVersionConflict,
      acknowledgeSurveyConflictAndFinalize,
      dismissSurveyConflictReview,
      createDraftRevision,
      deleteDraft,
      duplicateDraft,
      updateDraftStatus,
      addClient,
      getStepCompletionStates,
      calculateProgress
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
