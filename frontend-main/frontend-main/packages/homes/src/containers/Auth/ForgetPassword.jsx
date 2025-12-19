import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { MdEmail } from 'react-icons/md';
import { Input, Button, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import Logo from 'components/UI/Logo/Logo';
import FormControl from 'components/UI/FormControl/FormControl';
import { useNavigate } from 'react-router-dom';

import Wrapper, {
  Title,
  TitleInfo,
  FormWrapper,
  BannerWrapper,
} from './Auth.style';
export default function ForgotOrResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isResetMode = !!token;
  const navigate = useNavigate();

  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm({ mode: 'onChange' });

  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState(
    isResetMode
      ? 'Enter your new password below'
      : 'Enter your email to recover your account',
  );

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const endpoint = isResetMode
        ? 'auth/reset-password'
        : 'auth/forgot-password';

      const body = isResetMode
        ? {
            password: data.password,
            passwordConfirmation: data.passwordConfirmation,
            code: token,
          }
        : { email: data.email };

      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const result = await response.json();

      if (!response.ok) throw result;

      if (isResetMode) {
        message.success('Password has been reset. You can now log in.');
        setInfoMessage('Password successfully reset!');
        navigate('/sign-in', { replace: true });
      } else {
        message.success('Password reset email sent! Check your inbox.');
        setInfoMessage('Password reset email sent!');
      }
      reset();
    } catch (error) {
      const msg =
        error?.error?.message || error?.message || 'An error occurred.';
      message.error(msg);
      setInfoMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <FormWrapper>
        <Logo
          withLink
          linkTo="/"
          src="/images/logo-alt.svg"
          title="TripFinder."
        />
        <Title>{isResetMode ? 'Reset Password' : 'Forgot Password'}</Title>
        <TitleInfo>{infoMessage}</TitleInfo>

        <form onSubmit={handleSubmit(onSubmit)}>
          {isResetMode ? (
            <>
              <FormControl
                label="New Password"
                htmlFor="password"
                error={errors.password && <span>Password is required!</span>}
              >
                <Controller
                  name="password"
                  defaultValue=""
                  control={control}
                  rules={{ required: true, minLength: 6 }}
                  render={({ field }) => (
                    <Input.Password
                      placeholder="Enter new password"
                      {...field}
                    />
                  )}
                />
              </FormControl>

              <FormControl
                label="Confirm Password"
                htmlFor="passwordConfirmation"
                error={
                  errors.passwordConfirmation && (
                    <span>
                      Passwords must match and be at least 6 characters.
                    </span>
                  )
                }
              >
                <Controller
                  name="passwordConfirmation"
                  defaultValue=""
                  control={control}
                  rules={{
                    required: true,
                    minLength: 6,
                    validate: (value) =>
                      value === control._formValues.password ||
                      'Passwords do not match',
                  }}
                  render={({ field }) => (
                    <Input.Password
                      placeholder="Confirm new password"
                      {...field}
                    />
                  )}
                />
              </FormControl>
            </>
          ) : (
            <FormControl
              label="Email"
              htmlFor="email"
              error={
                errors.email && (
                  <>
                    {errors.email?.type === 'required' && (
                      <span>This field is required!</span>
                    )}
                    {errors.email?.type === 'pattern' && (
                      <span>Please enter a valid email address!</span>
                    )}
                  </>
                )
              }
            >
              <Controller
                name="email"
                defaultValue=""
                control={control}
                rules={{
                  required: true,
                  pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                }}
                render={({ field }) => (
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    {...field}
                  />
                )}
              />
            </FormControl>
          )}

          <Button
            className="signin-btn"
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            style={{ width: '100%' }}
          >
            <MdEmail />
            {isResetMode ? 'Reset Password' : 'Send Email'}
          </Button>
        </form>
      </FormWrapper>

      <BannerWrapper>
        <img src="/images/login-page-bg.jpg" alt="Auth page banner" />
      </BannerWrapper>
    </Wrapper>
  );
}
