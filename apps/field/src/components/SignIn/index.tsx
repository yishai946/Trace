import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { INVALID_PHONE, sendCode, sendCodeErrorMessage, verifyCode, verifyErrorMessage } from '../../auth';
import { toE164 } from '../../auth/phone';
import { ApiRequestError } from '../../api';
import { useSession } from '../../state/session';
import { CodeStep } from './CodeStep';
import { PhoneStep } from './PhoneStep';
import { useCountdown } from './useCountdown';

/** Fm01: the phone number, then the code from the SMS (UC-F01). `onSignedIn` runs once the session is saved. */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const signIn = useSession((s) => s.signIn);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  /** E.164 of the number the code was sent to; set means the code step. */
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, startCountdown] = useCountdown();

  const send = useMutation({ mutationFn: sendCode });
  const resend = useMutation({ mutationFn: sendCode });
  const verify = useMutation({
    mutationFn: (v: { phoneNumber: string; code: string }) => verifyCode(v.phoneNumber, v.code),
  });

  const submitPhone = () => {
    if (send.isPending) return;
    const e164 = toE164(phoneInput);
    if (!e164) {
      setPhoneError(INVALID_PHONE);
      return;
    }
    setPhoneError(null);
    send.mutate(e164, {
      onSuccess: () => {
        setCode('');
        setNotice(null);
        setPhoneNumber(e164);
      },
    });
  };

  if (phoneNumber === null) {
    return (
      <PhoneStep
        value={phoneInput}
        onChange={(value) => {
          setPhoneInput(value);
          setPhoneError(null);
        }}
        onSubmit={submitPhone}
        pending={send.isPending}
        error={phoneError ?? (send.isError ? sendCodeErrorMessage(send.error) : null)}
      />
    );
  }

  const onVerify = (value: string) => {
    if (verify.isPending) return;
    verify.mutate(
      { phoneNumber, code: value },
      {
        onSuccess: async ({ token }) => {
          await signIn(token);
          onSignedIn();
        },
        onError: () => setCode(''),
      },
    );
  };

  const onResend = () => {
    resend.mutate(phoneNumber, {
      onSuccess: () => {
        setCode('');
        setNotice('נשלח קוד חדש');
        verify.reset();
      },
      onError: (error) => {
        if (error instanceof ApiRequestError && error.status === 429 && error.retryAfter)
          startCountdown(error.retryAfter);
      },
    });
  };

  const error = verify.isError
    ? verifyErrorMessage(verify.error)
    : resend.isError
      ? sendCodeErrorMessage(resend.error)
      : null;

  return (
    <CodeStep
      phoneNumber={phoneNumber}
      code={code}
      onCodeChange={(value) => {
        setCode(value);
        setNotice(null);
      }}
      onVerify={onVerify}
      verifyPending={verify.isPending}
      onResend={onResend}
      resendPending={resend.isPending}
      countdown={countdown}
      onChangeNumber={() => {
        setPhoneNumber(null);
        send.reset();
        resend.reset();
        verify.reset();
        setNotice(null);
        startCountdown(0);
      }}
      error={error}
      notice={notice}
    />
  );
}
