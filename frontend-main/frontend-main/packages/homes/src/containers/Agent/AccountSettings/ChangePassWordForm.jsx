import React, { useContext, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Input, Button, Row, Col, message } from 'antd';
import FormControl from 'components/UI/FormControl/FormControl';
import { FormTitle } from './AccountSettings.style';
import { AuthContext } from 'context/AuthProvider';

export default function ChangePassWord() {
  const {
    control,
    formState: { errors },
    watch,
    handleSubmit,
  } = useForm({ mode: 'onChange' });

  const { token } = useContext(AuthContext);
  const [serverError, setServerError] = useState(null); // ✅ Add server error state

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');

  const onSubmit = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      message.error('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: data.oldPassword,
            password: data.newPassword,
            passwordConfirmation: data.confirmPassword,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error?.message || 'Password update failed');
      }
      alert('Password updated successfully!');
      //message.success('Password updated successfully!');
      setServerError(null); // ✅ Clear error on success
    } catch (error) {
      console.error(error);
      setServerError(error.message); // ✅ Store error message
    }
  };

  return (
    <>
      <FormTitle>Change Password</FormTitle>
      <form className="form-container" onSubmit={handleSubmit(onSubmit)}>
        <Row gutter={30}>
          <Col lg={12} xs={24}>
            <FormControl
              label="Enter old password"
              htmlFor="oldPassword"
              error={
                errors.oldPassword ? (
                  <span>This field is required!</span>
                ) : serverError ? (
                  <span>{serverError}</span> //  Display server error
                ) : null
              }
            >
              <Controller
                name="oldPassword"
                defaultValue=""
                control={control}
                rules={{ required: true }}
                render={({ field }) => <Input.Password {...field} />}
              />
            </FormControl>
          </Col>
          <Col lg={12} xs={24}>
            <FormControl
              label="Enter new password"
              htmlFor="newPassword"
              error={
                errors.newPassword && (
                  <>
                    {errors.newPassword?.type === 'required' && (
                      <span>This field is required!</span>
                    )}
                    {errors.newPassword?.type === 'minLength' && (
                      <span>New password must be at least 6 characters!</span>
                    )}
                    {errors.newPassword?.type === 'maxLength' && (
                      <span>
                        New password must not be longer than 20 characters!
                      </span>
                    )}
                  </>
                )
              }
            >
              <Controller
                name="newPassword"
                defaultValue=""
                control={control}
                rules={{ required: true, minLength: 6, maxLength: 20 }}
                render={({ field }) => <Input.Password {...field} />}
              />
            </FormControl>
          </Col>
          <Col lg={24} xs={24}>
            <FormControl
              label="Confirm new password"
              htmlFor="confirmPassword"
              error={
                confirmPassword &&
                newPassword !== confirmPassword && (
                  <span>Confirm password must match new password!</span>
                )
              }
            >
              <Controller
                name="confirmPassword"
                defaultValue=""
                control={control}
                rules={{ required: true }}
                render={({ field }) => <Input.Password {...field} />}
              />
            </FormControl>
          </Col>
          <Col lg={24}>
            <div className="submit-container">
              <Button htmlType="submit" type="primary">
                Save Changes
              </Button>
            </div>
          </Col>
        </Row>
      </form>
    </>
  );
}
