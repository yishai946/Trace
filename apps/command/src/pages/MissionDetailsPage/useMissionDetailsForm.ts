import { canEditMissionDetails } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { useState, type FormEvent } from 'react';
import { useUpdateMissionDetails } from '../../mission/missionQueries';
import {
  fromMission,
  isChanged,
  toUpdateBody,
  validate,
  type DetailsErrors,
  type MissionDetailsForm,
} from './missionDetailsForm';

interface Input {
  mission: Mission;
  /** Without a connection, nothing can be saved. */
  online: boolean;
}

/** The mission details form (UC-C03): what was typed, what is wrong with it, and saving it with the new photo. */
export function useMissionDetailsForm({ mission, online }: Input) {
  // Read once at open: a change that arrives later does not overwrite what the commander is typing.
  const [form, setForm] = useState<MissionDetailsForm>(() => fromMission(mission));
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [saved, setSaved] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  // The commander marks a change as significant (decision 34); it is off for every save.
  const [notify, setNotify] = useState(false);
  const save = useUpdateMissionDetails(mission.id);

  const readOnly = !canEditMissionDetails(mission.status);
  const changed = isChanged(form, mission) || photo !== null;
  const canSave = online && !readOnly && changed && !save.isPending;

  const update = (changes: Partial<MissionDetailsForm>) => {
    const next = { ...form, ...changes };
    setForm(next);
    setSaved(false);
    setPhotoFailed(false);
    // Once the commander has tried to save, the marks follow what they fix.
    if (Object.keys(errors).length > 0) setErrors(validate(next));
  };

  const choosePhoto = (file: File | null) => {
    setPhoto(file);
    setSaved(false);
    setPhotoFailed(false);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !canSave) return;
    save.mutate(
      { body: toUpdateBody(form, notify), photo },
      {
        onSuccess: (result) => {
          setSaved(!result.photoFailed);
          setPhotoFailed(result.photoFailed);
          // The details are saved either way: a retry of the photo must not send the flag again.
          setNotify(false);
          if (!result.photoFailed) setPhoto(null);
        },
      },
    );
  };

  return {
    form,
    photo,
    errors,
    saved,
    photoFailed,
    notify,
    setNotify,
    save,
    readOnly,
    canSave,
    update,
    choosePhoto,
    submit,
  };
}
