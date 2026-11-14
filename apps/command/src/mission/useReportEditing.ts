import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

export interface ReportEditing {
  editing: boolean;
  confirmingDelete: boolean;
  openEdit: () => void;
  closeEdit: () => void;
  openConfirm: () => void;
  closeConfirm: () => void;
  editButton: RefObject<HTMLButtonElement | null>;
  deleteButton: RefObject<HTMLButtonElement | null>;
  cancelDelete: RefObject<HTMLButtonElement | null>;
  /** Escape closes the form or the confirmation, unless a field already used it. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * The edit form and the delete confirmation of one report, with their focus: opening the confirmation focuses
 * "בטל", and closing a form or confirmation returns focus to the button that opened it (not to the page).
 */
export function useReportEditing(): ReportEditing {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<'edit' | 'delete' | null>(null);
  useEffect(() => {
    if (confirmingDelete) {
      cancelDelete.current?.focus();
      return;
    }
    if (editing) return;
    (returnTo.current === 'edit' ? editButton : returnTo.current === 'delete' ? deleteButton : null)?.current?.focus();
    returnTo.current = null;
  }, [editing, confirmingDelete]);
  const closeEdit = () => {
    returnTo.current = 'edit';
    setEditing(false);
  };
  const closeConfirm = () => {
    returnTo.current = 'delete';
    setConfirmingDelete(false);
  };
  return {
    editing,
    confirmingDelete,
    openEdit: () => setEditing(true),
    closeEdit,
    openConfirm: () => setConfirmingDelete(true),
    closeConfirm,
    editButton,
    deleteButton,
    cancelDelete,
    onKeyDown: (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (editing) closeEdit();
      else if (confirmingDelete) closeConfirm();
    },
  };
}
