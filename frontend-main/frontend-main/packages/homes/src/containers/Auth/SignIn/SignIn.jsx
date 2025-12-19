import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Divider } from 'antd';
import Logo from 'components/UI/Logo/Logo';
import { REGISTRATION_PAGE } from 'settings/constant';
import SignInForm from './SignInForm';
// import WalletConnectButton from 'components/WalletConnect/WalletConnectButton';
import Wrapper, {
  Title,
  TitleInfo,
  Text,
  FormWrapper,
  BannerWrapper,
} from '../Auth.style';

const SignIn = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Capture the current location when user visits sign-in page
  useEffect(() => {
    // If user came from within the app, store the path
    if (location.state?.from) {
      // Already has redirect info, no need to do anything
      return;
    }

    // If user came from external source or direct URL, set default redirect
    const currentPath = location.pathname;
    if (currentPath === '/sign-in' || currentPath === '/login') {
      // User came directly to sign-in page, redirect to homepage after login
      navigate(currentPath, { 
        state: { from: '/' },
        replace: true 
      });
    }
  }, [location, navigate]);

  return (
    <Wrapper>
      <FormWrapper>
        <Logo
          withLink
          linkTo="/"
          src="/images/logo-alt.svg"
          title="TripFinder."
        />
        <Title>Welcome Back</Title>
        <TitleInfo>Please log into your account</TitleInfo>
        
        {/* Wallet connect removed; email/password only */}
        
        {/* Normal Email/Password Login */}
        <SignInForm />
        <Divider> </Divider>

        <Text>
          Don't Have an Account?&nbsp;
          <Link to={REGISTRATION_PAGE}>Registration</Link>
        </Text>
      </FormWrapper>
      <BannerWrapper>
        <img src="/images/login-page-bg.jpg" alt="Auth page banner" />
      </BannerWrapper>
    </Wrapper>
  );
};

export default SignIn;
