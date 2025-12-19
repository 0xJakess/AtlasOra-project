import React, { useContext, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { MdLockOpen } from 'react-icons/md';
import { Input, Switch, Button } from 'antd';
import FormControl from 'components/UI/FormControl/FormControl';
import { AuthContext } from 'context/AuthProvider';
import { FORGET_PASSWORD_PAGE } from 'settings/constant';
import { FieldWrapper, SwitchWrapper, Label } from '../Auth.style';

export default function SignInForm() {
  const { signIn, loggedIn } = useContext(AuthContext);
  const [formError, setFormError] = useState(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm();

  const onSubmit = async (data) => {
    try {
      await signIn(data);
      setFormError(null); // Clear any previous error on success
    } catch (data) {
      if (data.error?.status === 400) {
        // console.log(data.error.status);
        setFormError(data?.error?.message || 'Invalid identifier or password');
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  };

  if (loggedIn) {
    // Redirect if already logged in
    const returnTo = localStorage.getItem('returnTo');
    if (returnTo && returnTo !== '/login' && returnTo !== '/sign-in') {
      return <Navigate to={returnTo} replace={true} />;
    }
    return <Navigate to="/" replace={true} />;
  }

  return (
    <>
      {formError && (
        <div style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>
          {formError}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl
          label="Email"
          htmlFor="email"
          error={
            errors.identifier && (
              <>
                {errors.identifier.type === 'required' && (
                  <span>This field is required!</span>
                )}
                {errors.identifier.type === 'pattern' && (
                  <span>Please enter a valid email address!</span>
                )}
              </>
            )
          }
        >
          <Controller
            name="identifier"
            defaultValue=""
            control={control}
            rules={{
              required: true,
              pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                type="email"
                onChange={onChange}
                onBlur={onBlur}
                value={value}
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
                {errors.password.type === 'required' && (
                  <span>This field is required!</span>
                )}
                {errors.password.type === 'minLength' && (
                  <span>Password must be at least 6 characters!</span>
                )}
                {errors.password.type === 'maxLength' && (
                  <span>Password must not be longer than 20 characters!</span>
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

        <FieldWrapper>
          <Link to={FORGET_PASSWORD_PAGE}>Forget Password ?</Link>
        </FieldWrapper>

        <Button
          className="signin-btn"
          type="primary"
          htmlType="submit"
          size="large"
          style={{ width: '100%' }}
        >
          <MdLockOpen />
          Login
        </Button>
      </form>
    </>
  );
}
