import React, { useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { MdLockOpen } from 'react-icons/md';
import { Input, Switch, Button } from 'antd';
import FormControl from 'components/UI/FormControl/FormControl';
import { AuthContext } from 'context/AuthProvider';
import { FieldWrapper, SwitchWrapper, Label } from '../Auth.style';

const SignUpForm = () => {
  const { signUp, loggedIn } = useContext(AuthContext);
  const [apiError, setApiError] = useState('');

  const {
    control,
    watch,
    formState: { errors },
    handleSubmit,
    setError,
  } = useForm({
    mode: 'onChange',
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  const onSubmit = async (data) => {
    try {
      setApiError('');
      await signUp(data);
    } catch (data) {
      const message = data?.error?.message || 'An unexpected error occurred';
      setApiError(message);

      // Only show inline errors for password-related API errors
      if (message.toLowerCase().includes('password')) {
        setError('password', { type: 'manual', message });
      }
      // No inline error for username/email "already taken"
    }
  };

  if (loggedIn) {
    // return <Navigate to="/" replace={true} />;
  }

  return (
    <>
      {apiError && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{apiError}</div>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl
          label="Username"
          htmlFor="username"
          error={
            errors.username && (
              <>
                {errors.username?.type === 'required' && (
                  <span>This field is required!</span>
                )}
                {errors.username?.type === 'manual' && (
                  <span>{errors.username.message}</span>
                )}
              </>
            )
          }
        >
          <Controller
            name="username"
            defaultValue=""
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input onChange={onChange} onBlur={onBlur} value={value} />
            )}
          />
        </FormControl>

        <FormControl
          label="Email"
          htmlFor="email"
          error={
            errors.email?.type === 'required' && (
              <span>This field is required!</span>
            )
          }
        >
          <Controller
            name="email"
            defaultValue=""
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                onChange={onChange}
                onBlur={onBlur}
                value={value}
                placeholder="Enter email or username"
              />
            )}
          />
        </FormControl>

        <FormControl
          label="Password"
          htmlFor="password"
          error={
            errors.password && (
              <>
                {errors.password?.type === 'required' && (
                  <span>This field is required!</span>
                )}
                {errors.password?.type === 'minLength' && (
                  <span>Password must be at least 6 characters!</span>
                )}
                {errors.password?.type === 'maxLength' && (
                  <span>Password must not be longer than 20 characters!</span>
                )}
                {errors.password?.type === 'manual' && (
                  <span>{errors.password.message}</span>
                )}
              </>
            )
          }
        >
          <Controller
            name="password"
            defaultValue=""
            control={control}
            rules={{ required: true, minLength: 6, maxLength: 20 }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input.Password
                onChange={onChange}
                onBlur={onBlur}
                value={value}
              />
            )}
          />
        </FormControl>

        <FormControl
          label="Confirm password"
          htmlFor="confirmPassword"
          error={
            confirmPassword &&
            password !== confirmPassword && (
              <span>Your password is not the same!</span>
            )
          }
        >
          <Controller
            name="confirmPassword"
            defaultValue=""
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input.Password
                onChange={onChange}
                onBlur={onBlur}
                value={value}
              />
            )}
          />
        </FormControl>

        <FieldWrapper>
          <SwitchWrapper>
            <Controller
              control={control}
              name="termsAndConditions"
              valueName="checked"
              defaultValue={false}
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <Switch onChange={onChange} checked={value} />
              )}
            />
            <Label>I agree with terms and conditions</Label>
          </SwitchWrapper>
          {errors.termsAndConditions && (
            <span style={{ color: 'red' }}>
              You must agree with the terms and conditions
            </span>
          )}
        </FieldWrapper>

        <Button
          className="signin-btn"
          type="primary"
          htmlType="submit"
          size="large"
          style={{ width: '100%' }}
          disabled={!watch('termsAndConditions')}
        >
          <MdLockOpen />
          Register
        </Button>
      </form>
    </>
  );
};

export default SignUpForm;
