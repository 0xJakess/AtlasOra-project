import React, { useContext, Fragment, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Row, Col, Input, Select, Button, DatePicker } from 'antd';
import FormControl from 'components/UI/FormControl/FormControl';
import { FormTitle } from './AccountSettings.style';
import { AuthContext } from 'context/AuthProvider';
import dayjs from 'dayjs';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'Other' },
];

const languageOptions = [
  { label: 'English', value: 'english' },
  { label: 'Spanish', value: 'spanish' },
  { label: 'French', value: 'french' },
  { label: 'Russian', value: 'russian' },
];

const AgentCreateOrUpdateForm = () => {
  const { user: userInfo, token } = useContext(AuthContext);
  const { address, isConnected } = useAccount();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm();

  const onSubmit = async (data) => {
    try {
      const payload = {
        FirstName: data.firstName,
        SecondName: data.lastName,
        DateOfBirth: dayjs(data.dateOfBirthday).format('YYYY-MM-DD'),
        Gender: data.agentGender,
        PreferredLanguage: data.preferredLanguage,
        email: data.email,
        PhoneNumber: data.phoneNumber,
        Location: data.address,
        Bio: data.describeYourself,
      };

      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}users/${userInfo.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error('Failed to update user');
      const result = await response.json();
      result.avatar = userInfo.avatar;
      localStorage.setItem('user', JSON.stringify(result));

      console.log('✅ Update successful:', result);
      // Optionally: show a toast or update AuthContext
    } catch (error) {
      console.error('❌ Error updating user:', error);
    }
  };

  const adminBaseUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:1337/api/';

  const linkWallet = async () => {
      try {
          setLinking(true);
          setLinkError('');
          setLinkSuccess('');
          if (!window.ethereum) throw new Error('MetaMask not found');
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const userAddress = await signer.getAddress();

          // Sign a simple message to prove ownership
          const message = `Linking wallet to account ${userInfo?.email || userInfo?.username} at ${new Date().toISOString()}`;
          const signature = await signer.signMessage(message);

          // Send to Strapi custom endpoint or direct user update if permitted
          // Expecting a custom route to verify signature and save walletAddress
          const res = await fetch(`${adminBaseUrl}users-permissions/link-wallet`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ walletAddress: userAddress, message, signature }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result?.error?.message || result?.error || 'Failed to link wallet');
          setLinkSuccess('Wallet linked successfully');
      } catch (err) {
          setLinkError(err.message || 'Failed to link wallet');
      } finally {
          setLinking(false);
      }
  };

  return (
    <Fragment>
      <FormTitle>Basic Information</FormTitle>
      <form className="form-container" onSubmit={handleSubmit(onSubmit)}>
        <Row gutter={30}>
          <Col lg={12} xs={24}>
            <FormControl
              label="First name"
              htmlFor="firstName"
              error={errors.firstName && <span>This field is required!</span>}
            >
              <Controller
                name="firstName"
                defaultValue={userInfo?.FirstName || ''}
                control={control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} />}
              />
            </FormControl>
          </Col>
          <Col lg={12} xs={24}>
            <FormControl
              label="Last name"
              htmlFor="lastName"
              error={errors.lastName && <span>This field is required!</span>}
            >
              <Controller
                name="lastName"
                defaultValue={userInfo?.SecondName || ''}
                control={control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} />}
              />
            </FormControl>
          </Col>
        </Row>

        <Row gutter={30}>
          <Col lg={12} xs={24}>
            <FormControl
              label="Date of birth"
              htmlFor="dateOfBirthday"
              error={
                errors.dateOfBirthday && <span>This field is required!</span>
              }
            >
              <Controller
                name="dateOfBirthday"
                defaultValue={
                  userInfo?.DateOfBirth ? dayjs(userInfo.DateOfBirth) : null
                }
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <DatePicker
                    onChange={onChange}
                    value={value ? dayjs(value) : null}
                    format="YYYY-MM-DD"
                  />
                )}
              />
            </FormControl>
          </Col>

          <Col lg={12} xs={24}>
            <Row gutter={30}>
              <Col sm={12} xs={24}>
                <FormControl
                  label="I am"
                  htmlFor="agentGender"
                  error={
                    errors.agentGender && <span>This field is required!</span>
                  }
                >
                  <Controller
                    name="agentGender"
                    defaultValue={userInfo?.Gender || ''}
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        options={genderOptions}
                        {...field}
                        defaultValue={userInfo?.Gender || 'male'}
                      />
                    )}
                  />
                </FormControl>
              </Col>

              <Col sm={12} xs={24}>
                <FormControl
                  label="Preferred Language"
                  htmlFor="preferredLanguage"
                  error={
                    errors.preferredLanguage && (
                      <span>This field is required!</span>
                    )
                  }
                >
                  <Controller
                    name="preferredLanguage"
                    defaultValue={userInfo?.PreferredLanguage || ''}
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        options={languageOptions}
                        {...field}
                        defaultValue={userInfo?.PreferredLanguage || 'english'}
                      />
                    )}
                  />
                </FormControl>
              </Col>
            </Row>
          </Col>
        </Row>

        <Row gutter={30}>
          <Col lg={12} xs={24}>
            <FormControl
              label="Email address"
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
                defaultValue={userInfo?.email || ''}
                control={control}
                rules={{
                  required: true,
                  pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                }}
                render={({ field }) => <Input type="email" {...field} />}
              />
            </FormControl>
          </Col>

          <Col lg={12} xs={24}>
            <FormControl
              label="Phone number"
              htmlFor="phoneNumber"
              error={
                errors.phoneNumber && (
                  <>
                    {errors.phoneNumber?.type === 'required' && (
                      <span>This field is required!</span>
                    )}
                    {errors.phoneNumber?.type === 'pattern' && (
                      <span>Please enter your valid number!</span>
                    )}
                  </>
                )
              }
            >
              <Controller
                name="phoneNumber"
                defaultValue={userInfo?.PhoneNumber || ''}
                control={control}
                rules={{
                  required: true,
                  pattern: /^[0-9]*$/,
                }}
                render={({ field }) => <Input {...field} />}
              />
            </FormControl>
          </Col>

          <Col lg={24} xs={24}>
            <FormControl
              label="Where you live"
              htmlFor="address"
              error={errors.address && <span>This field is required!</span>}
            >
              <Controller
                name="address"
                defaultValue={userInfo?.Location || ''}
                control={control}
                rules={{ required: true }}
                render={({ field }) => <Input {...field} />}
              />
            </FormControl>
          </Col>

          <Col lg={24} xs={24}>
            <FormControl
              label="Describe Yourself (Optional)"
              htmlFor="describeYourself"
            >
              <Controller
                name="describeYourself"
                defaultValue={userInfo?.Bio || ''}
                control={control}
                rules={{ required: true }}
                render={({ field }) => <Input.TextArea rows={5} {...field} />}
              />
            </FormControl>
          </Col>
        </Row>

        <div className="submit-container">
          <Button htmlType="submit" type="primary">
            Save Changes
          </Button>
        </div>
      </form>
      <hr />
      <h3>Wallet</h3>
      <p>Link your wallet to your account to enable on-chain actions.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={linkWallet} disabled={linking}>
              {linking ? 'Linking...' : isConnected ? 'Link Connected Wallet' : 'Connect Wallet then Link'}
          </button>
          {address && <small>Connected: {address.slice(0,6)}...{address.slice(-4)}</small>}
      </div>
      {linkError && <div style={{ color: '#dc3545', marginTop: 8 }}>{linkError}</div>}
      {linkSuccess && <div style={{ color: '#28a745', marginTop: 8 }}>{linkSuccess}</div>}
    </Fragment>
  );
};

export default AgentCreateOrUpdateForm;
