import { isPhotoType, MAX_PHOTO_BYTES, PHOTO_TYPES } from '@trace/domain';
import { useEffect, useRef, useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { Button } from '../../components/Button';
import styles from './NewMissionPage.module.css';

export const PHOTO_ERROR = `התמונה צריכה להיות JPEG,‏ PNG או WebP, עד ${MAX_PHOTO_BYTES / 1024 / 1024}MB.`;

interface PhotoPickerProps {
  photo: File | null;
  onChange: (photo: File | null) => void;
}

/** The missing person's photo, optional (decision 1). The server checks the file again when it is uploaded. */
export function PhotoPicker({ photo, onChange }: PhotoPickerProps) {
  const [error, setError] = useState<string | null>(null);
  // The preview is a browser object URL, released when the photo is replaced or removed, or the screen closes.
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const show = (file: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setPreview(previewRef.current);
    onChange(file);
  };

  const choose = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!isPhotoType(file.type) || file.size > MAX_PHOTO_BYTES) {
      setError(PHOTO_ERROR);
      return;
    }
    setError(null);
    show(file);
  };

  return (
    <div className={styles.photo}>
      {preview ? (
        <img className={styles.photoImage} src={preview} alt="תמונת הנעדר" />
      ) : (
        <div className={styles.photoEmpty} aria-hidden="true">
          תמונה
        </div>
      )}
      <FileTrigger acceptedFileTypes={[...PHOTO_TYPES]} onSelect={choose}>
        <Button>{photo ? 'החלף' : 'הוסף תמונה'}</Button>
      </FileTrigger>
      {photo && (
        <Button variant="danger-outline" onPress={() => show(null)}>
          הסר
        </Button>
      )}
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
