'use client';

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, FC, FormEvent } from 'react';

type ActionState<T> = {
  data: T | null;
  error: string | null;
  isPending: boolean;
};

interface ActionContextValue {
  submitAction: <T>(action: string, data: unknown, options?: ActionSubmitOptions) => Promise<T>;
  actionState: Record<string, ActionState<unknown>>;
  getCsrfToken: () => string | null;
}

interface ActionSubmitOptions {
  skipCsrf?: boolean;
}

const ActionContext = createContext<ActionContextValue | null>(null);

function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const CSRF_TOKEN_KEY = '__rsc_csrf_token';

function validateCsrfOrigin(requestOrigin: string | null): boolean {
  if (!requestOrigin) return true;
  const allowedOrigins = typeof window !== 'undefined' 
    ? [window.location.origin] 
    : [];
  return allowedOrigins.includes(requestOrigin);
}

export function ActionProvider({ children }: { children: ReactNode }) {
  const [actionState, setActionState] = useState<Record<string, ActionState<unknown>>>({});
  const csrfTokenRef = useRef<string | null>(null);

  const getCsrfToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    if (!csrfTokenRef.current) {
      const meta = document.querySelector('meta[name="csrf-token"]');
      csrfTokenRef.current = meta?.getAttribute('content') ?? null;
    }
    return csrfTokenRef.current;
  }, []);

  const submitAction = useCallback(async <T,>(
    action: string, 
    data: unknown, 
    options: ActionSubmitOptions = {}
  ): Promise<T> => {
    const { skipCsrf = false } = options;
    
    setActionState(prev => ({
      ...prev,
      [action]: { ...prev[action], isPending: true, error: null }
    }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      if (!skipCsrf) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : null;
        if (origin) {
          headers['Origin'] = origin;
        }
      }

      const response = await fetch(action, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const result = await response.json() as T;
      
      setActionState(prev => ({
        ...prev,
        [action]: { data: result, error: null, isPending: false }
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Action failed';
      
      setActionState(prev => ({
        ...prev,
        [action]: { data: null, error: errorMessage, isPending: false }
      }));
      
      throw error;
    }
  }, [getCsrfToken]);

  return (
    <ActionContext.Provider value={{ submitAction, actionState, getCsrfToken }}>
      {children}
    </ActionContext.Provider>
  );
}

export function useActionState<T>(
  action: string,
  initialState: T | null = null
): [T | null, (data: unknown) => Promise<T>, boolean, string | null] {
  const context = React.useContext(ActionContext);
  const getCsrfToken = context?.getCsrfToken ?? (() => null);
  
  const [localState, setLocalState] = useState<T | null>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: unknown): Promise<T> => {
    setIsPending(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : null;
      if (origin) {
        headers['Origin'] = origin;
      }

      const response = await fetch(action, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const result = await response.json() as T;
      setLocalState(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [action, getCsrfToken]);

  return [localState, submit, isPending, error];
}

type FormProps = {
  action: string;
  method?: 'post' | 'get';
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
  className?: string;
  encType?: string;
};

export const Form: FC<FormProps> = ({
  action,
  method = 'post',
  onSuccess,
  onError,
  children,
  className,
  encType,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const csrfTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    csrfTokenRef.current = meta?.getAttribute('content') ?? null;
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!formRef.current) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(formRef.current);
      const data: Record<string, unknown> = {};
      
      formData.forEach((value, key) => {
        if (data[key]) {
          if (Array.isArray(data[key])) {
            (data[key] as unknown[]).push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfToken = csrfTokenRef.current;
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : null;
      if (origin) {
        headers['Origin'] = origin;
      }

      const response = await fetch(action, {
        method,
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const result = await response.json();
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Form submission failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsSubmitting(false);
    }
  }, [action, method, onSuccess, onError]);

  return React.createElement('form', {
    ref: formRef,
    action,
    method,
    onSubmit: handleSubmit,
    className,
    encType,
  }, children);
};

export function useSubmit<TFormData extends Record<string, unknown>>(
  action: string,
  options: {
    onSuccess?: (data: TFormData) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const [isPending, setIsPending] = useState(false);
  const csrfTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    csrfTokenRef.current = meta?.getAttribute('content') ?? null;
  }, []);

  const submit = useCallback(async (data: TFormData): Promise<void> => {
    setIsPending(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfToken = csrfTokenRef.current;
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : null;
      if (origin) {
        headers['Origin'] = origin;
      }

      const response = await fetch(action, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      options.onSuccess?.(data);
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error('Submit failed'));
    } finally {
      setIsPending(false);
    }
  }, [action, options]);

  return { submit, isPending };
}

export function LoadingOverlay({ 
  isLoading, 
  children 
}: { 
  isLoading: boolean; 
  children: ReactNode 
}) {
  if (!isLoading) return React.createElement(React.Fragment, null, children);
  
  return React.createElement('div', { className: 'loading-overlay' },
    React.createElement('div', { className: 'loading-spinner' }),
    children
  );
}

export function PendingUI({ 
  isPending, 
  fallback = null 
}: { 
  isPending: boolean; 
  fallback?: ReactNode 
}) {
  return isPending 
    ? React.createElement(React.Fragment, null, fallback)
    : null;
}

export { ActionContext };
