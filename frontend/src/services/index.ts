/**
 * Service Layer Index — LoopIn Frontend
 *
 * Dynamically switches between:
 * - Real AWS API Repository (apiRepository.ts) when in AWS mode (VITE_APP_MODE=aws)
 * - In-Memory Demo Repository (mockRepository.ts) when in local demo mode (VITE_APP_MODE=demo)
 */

import { IS_AWS, API_BASE_URL } from "@/lib/env.ts";
import * as mockRepo from "./mockRepository.ts";
import * as apiRepo from "./apiRepository.ts";

const useLiveAws = IS_AWS && Boolean(API_BASE_URL);

// Current User
export const getCurrentUser = useLiveAws ? apiRepo.getCurrentUser : mockRepo.getCurrentUser;
export const updateCurrentUser = useLiveAws ? apiRepo.updateCurrentUser : mockRepo.updateCurrentUser;
export const getUserProfile = useLiveAws ? apiRepo.getUserProfile : mockRepo.getUserProfile;

// Items
export const listItems = useLiveAws ? apiRepo.listItems : mockRepo.listItems;
export const getItem = useLiveAws ? apiRepo.getItem : mockRepo.getItem;
export const listMyItems = useLiveAws ? apiRepo.listMyItems : mockRepo.listMyItems;
export const createItem = useLiveAws ? apiRepo.createItem : mockRepo.createItem;
export const updateItem = useLiveAws ? apiRepo.updateItem : mockRepo.updateItem;
export const deleteItem = useLiveAws ? apiRepo.deleteItem : mockRepo.deleteItem;

// Loans
export const listLoans = useLiveAws ? apiRepo.listLoans : mockRepo.listLoans;
export const requestLoan = useLiveAws ? apiRepo.requestLoan : mockRepo.requestLoan;
export const cancelLoan = useLiveAws ? apiRepo.cancelLoan : mockRepo.cancelLoan;
export const approveLoan = useLiveAws ? apiRepo.approveLoan : mockRepo.approveLoan;
export const rejectLoan = useLiveAws ? apiRepo.rejectLoan : mockRepo.rejectLoan;
export const markReturned = useLiveAws ? apiRepo.markReturned : mockRepo.markReturned;

// Notifications
export const listNotifications = useLiveAws ? apiRepo.listNotifications : mockRepo.listNotifications;
export const markNotificationRead = useLiveAws ? apiRepo.markNotificationRead : mockRepo.markNotificationRead;

// Community Stats
export const getCommunityStats = useLiveAws ? apiRepo.getCommunityStats : mockRepo.getCommunityStats;

export type * from "./types.ts";
