import { isPhotoType, MAX_PHOTO_BYTES, PHOTO_TYPES } from '@trace/domain';
import { useEffect, useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { Button } from '../Button';
import styles from './PhotoPicker.module.css';
import { shrinkPhoto } from './shrinkPhoto';

export const PHOTO_ERROR = 'התמונה צריכה להיות JPEG,‏ PNG או WebP.';
export const PHOTO_READ_ERROR = 'לא ניתן לקרוא את התמונה. נסו תמונה אחרת.';

interface PhotoPickerProps {
  /** A new photo the commander chose, not uploaded yet. */
  photo: File | null;
  onChange: (photo: File | null) => void;
  /** The photo the mission already has (`missingPerson.photoUrl`), shown until a new one is chosen. */
  currentUrl?: string | null;
  /** The mission ended: the photo is shown without the buttons. */
  readOnly?: boolean;
}

/**
 * The missing person's photo, optional (decision 1). It is shrunk in the browser before it is kept (see shrinkPhoto),
 * and the server checks the file again when it is uploaded.
 */
export function PhotoPicker({ photo, onChange, currentUrl = null, readOnly = false }: PhotoPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // The preview is a browser object URL, released when the photo changes or the screen closes.
  useEffect(() => {
    if (!photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL belongs to the photo; clearing it follows the prop
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const choose = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!isPhotoType(file.type)) {
      setError(PHOTO_ERROR);
      return;
    }
    try {
      const small = await shrinkPhoto(file);
      if (small.size > MAX_PHOTO_BYTES) throw new Error('Still too large after shrinking');
      setError(null);
      onChange(small);
    } catch {
      setError(PHOTO_READ_ERROR);
    }
  };

  const src = preview ?? currentUrl;
  return (
    <div className={styles.photo}>
      {src ? (
        <img className={styles.photoImage} src={src} alt="תמונת הנעדר" />
      ) : (
        <div className={styles.photoEmpty} aria-hidden="true">
          תמונה
        </div>
      )}
      {!readOnly && (
        <FileTrigger acceptedFileTypes={[...PHOTO_TYPES]} onSelect={(files) => void choose(files)}>
          <Button>{photo || currentUrl ? 'החלף' : 'הוסף תמונה'}</Button>
        </FileTrigger>
      )}
      {!readOnly && photo && (
        <Button variant="danger-outline" onPress={() => onChange(null)}>
          הסר
        </Button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
