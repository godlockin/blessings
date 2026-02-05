import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    if (onRetry) onRetry(retries, error);
    await sleep(delay * (3 - retries + 1));
    return retryWithBackoff(fn, retries - 1, delay, onRetry);
  }
};
