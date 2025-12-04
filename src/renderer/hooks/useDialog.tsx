/**
 * Custom hooks for dialog management
 */

import { useState } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'default' | 'danger';
}

interface AlertDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'info' | 'success' | 'error';
  onConfirm: () => void;
}

interface ChoiceDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  choices: Array<{ label: string; value: string }>;
  onChoose: (value: string) => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const confirm = (options: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        variant: options.variant,
        onConfirm: () => {
          setState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
      });
    });
  };

  const cancel = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return { state, confirm, cancel };
}

export function useAlertDialog() {
  const [state, setState] = useState<AlertDialogState>({
    isOpen: false,
    title: '',
    description: '',
    variant: 'info',
    onConfirm: () => {},
  });

  const alert = (options: {
    title: string;
    description: string;
    confirmText?: string;
    variant?: 'info' | 'success' | 'error';
  }): Promise<void> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText,
        variant: options.variant,
        onConfirm: () => {
          setState((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
      });
    });
  };

  const close = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return { state, alert, close };
}

export function useChoiceDialog() {
  const [state, setState] = useState<ChoiceDialogState>({
    isOpen: false,
    title: '',
    description: '',
    choices: [],
    onChoose: () => {},
  });

  const choose = (options: {
    title: string;
    description: string;
    choices: Array<{ label: string; value: string }>;
  }): Promise<string | null> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        description: options.description,
        choices: options.choices,
        onChoose: (value: string) => {
          setState((prev) => ({ ...prev, isOpen: false }));
          resolve(value);
        },
      });
    });
  };

  const cancel = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return { state, choose, cancel };
}

