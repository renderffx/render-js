'use client';

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, FC, FormEvent } from 'react';

type ActionState<T> = {
  data: T | null;
  error: string | null;
  isPending: boolean;
};

const ActionContext = createContext<{
  submitAction: <T>(action: string, data: unknown) => Promise<T>;
  actionState: Record<string, ActionState<unknown>>;
} | null>(null);

export function ActionProvider({ children }: { children: ReactNode }) {
  const [actionState, setActionState] = useState<Record<string, ActionState<unknown>>>({});

  const submitAction = useCallback(async <T,>(action: string, data: unknown): Promise<T> => {
    setActionState(prev => ({
      ...prev,
      [action]: { ...prev[action], isPending: true, error: null }
    }));

    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, []);

  return (
    <ActionContext.Provider value={{ submitAction, actionState }}>
      {children}
    </ActionContext.Provider>
  );
}

export function useActionState<T>(
  action: string,
  initialState: T | null = null
): [T | null, (data: unknown) => Promise<T>, boolean, string | null] {
  const context = React.useContext(ActionContext);
  
  const [localState, setLocalState] = useState<T | null>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: unknown): Promise<T> => {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [action]);

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

      const response = await fetch(action, {
        method,
        headers: { 'Content-Type': 'application/json' },
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

  const submit = useCallback(async (data: TFormData): Promise<void> => {
    setIsPending(true);

    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
