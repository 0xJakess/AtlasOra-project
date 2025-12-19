import React, { useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import Sticky from 'react-stickynode';
import { IoIosClose } from 'react-icons/io';
import { Button, Drawer } from 'antd';
import Logo from 'components/UI/Logo/Logo';
import Text from 'components/UI/Text/Text';
import TextLink from 'components/UI/TextLink/TextLink';
import Navbar from 'components/Navbar/Navbar';
import { AuthContext } from 'context/AuthProvider';
import { LayoutContext } from 'context/LayoutProvider';
import useWindowSize from 'library/hooks/useWindowSize';
import { AGENT_PROFILE_PAGE } from 'settings/constant';
import AuthMenu from './AuthMenu';
import MainMenu from './MainMenu';
import MobileMenu from './MobileMenu';
import ProfileMenu from './ProfileMenu';
import NavbarSearch from './NavbarSearch';
import HeaderWrapper, {
  MobileNavbar,
  CloseDrawer,
  AvatarWrapper,
  AvatarImage,
  AvatarInfo,
  LogoArea,
} from './Header.style';



const LogoIcon = () => (
  <svg width="140" viewBox="0 0 691 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M676.379 132.732V126.361C670.555 131.596 663.4 134.213 654.911 134.213C648.397 134.213 642.573 132.682 637.441 129.621C632.012 126.46 627.669 122.115 624.412 116.584C621.253 110.954 619.674 104.732 619.674 97.917C619.674 91.1022 621.303 84.88 624.56 79.2504C627.817 73.6208 632.16 69.2257 637.589 66.0652C642.623 63.1023 648.298 61.6208 654.615 61.6208C663.005 61.6208 670.259 64.2381 676.379 69.4726V63.1023H690V132.732H676.379ZM675.935 110.954V84.88C670.901 78.2628 664.288 74.9541 656.096 74.9541C649.581 74.9541 644.202 77.2257 639.958 81.7689C635.812 86.2134 633.739 91.5961 633.739 97.917C633.739 104.238 635.911 109.67 640.254 114.213C644.695 118.658 650.223 120.88 656.836 120.88C664.633 120.88 671 117.571 675.935 110.954Z" fill="black" />
    <path d="M622.601 62.0652L620.972 75.5467C619.492 75.1517 617.666 74.9541 615.494 74.9541C611.941 74.9541 608.388 76.0899 604.834 78.3615C601.38 80.5344 598.665 83.2998 596.691 86.6578V132.732H582.626V63.1023H596.247V71.1023C598.122 68.4356 600.886 66.2134 604.538 64.4356C608.19 62.5591 612.385 61.6208 617.123 61.6208C619.097 61.6208 620.923 61.769 622.601 62.0652Z" fill="black" />
    <path d="M487.2 118.954C477.329 108.682 472.394 95.991 472.394 80.8799C472.394 65.7688 477.329 53.1268 487.2 42.954C497.169 32.6824 509.507 27.5466 524.213 27.5466C538.92 27.5466 551.209 32.6824 561.079 42.954C571.048 53.1268 576.033 65.7688 576.033 80.8799C576.033 95.991 571.048 108.682 561.079 118.954C551.209 129.127 538.92 134.213 524.213 134.213C509.507 134.213 497.169 129.127 487.2 118.954ZM487.2 80.8799C487.2 92.1391 490.704 101.522 497.712 109.028C504.818 116.435 513.652 120.139 524.213 120.139C534.775 120.139 543.559 116.435 550.567 109.028C557.674 101.522 561.227 92.1391 561.227 80.8799C561.227 69.7194 557.674 60.3861 550.567 52.8799C543.559 45.3738 534.775 41.6207 524.213 41.6207C513.652 41.6207 504.818 45.3738 497.712 52.8799C490.704 60.3861 487.2 69.7194 487.2 80.8799Z" fill="black" />
    <path d="M416.863 124.584L424.118 114.213C430.731 119.349 437.59 121.917 444.697 121.917C447.954 121.917 450.767 121.127 453.136 119.547C455.604 117.868 456.838 115.744 456.838 113.176C456.838 111.695 456.443 110.411 455.653 109.324C454.864 108.139 453.63 107.201 451.952 106.51C450.373 105.72 448.793 105.127 447.214 104.732C445.734 104.238 443.71 103.695 441.144 103.102C438.676 102.411 436.653 101.818 435.074 101.324C424.414 97.7689 419.084 91.7936 419.084 83.3986C419.084 76.3862 421.65 71.0035 426.783 67.2504C431.915 63.4973 437.936 61.6208 444.845 61.6208C453.926 61.6208 461.625 64.1887 467.942 69.3245L460.687 79.3986C455.851 75.7442 450.866 73.9171 445.733 73.9171C442.18 73.9171 439.17 74.7072 436.702 76.2874C434.333 77.8677 433.149 79.9911 433.149 82.6578C433.149 84.8306 434.136 86.4603 436.11 87.5467C438.183 88.6331 441.341 89.7195 445.585 90.8059C448.941 91.6948 451.853 92.6331 454.321 93.6208C456.788 94.5096 459.404 95.7936 462.168 97.4726C464.931 99.1516 467.053 101.324 468.534 103.991C470.113 106.559 470.903 109.522 470.903 112.88C470.903 119.201 468.337 124.337 463.204 128.287C458.17 132.238 452.1 134.213 444.993 134.213C434.136 134.213 424.759 131.003 416.863 124.584Z" fill="black" />
    <path d="M395.769 132.732V126.361C389.946 131.596 382.79 134.213 374.301 134.213C367.787 134.213 361.964 132.682 356.831 129.621C351.402 126.46 347.059 122.115 343.802 116.584C340.644 110.954 339.064 104.732 339.064 97.917C339.064 91.1022 340.693 84.88 343.95 79.2504C347.207 73.6208 351.55 69.2257 356.979 66.0652C362.013 63.1023 367.688 61.6208 374.005 61.6208C382.395 61.6208 389.65 64.2381 395.769 69.4726V63.1023H409.39V132.732H395.769ZM395.325 110.954V84.88C390.291 78.2628 383.678 74.9541 375.486 74.9541C368.971 74.9541 363.592 77.2257 359.348 81.7689C355.202 86.2134 353.13 91.5961 353.13 97.917C353.13 104.238 355.301 109.67 359.644 114.213C364.086 118.658 369.613 120.88 376.226 120.88C384.024 120.88 390.39 117.571 395.325 110.954Z" fill="black" />
    <path d="M316.908 132.732V27.5466H330.973V132.732H316.908Z" fill="black" />
    <path d="M305.963 119.991L308.776 132.732C305.815 133.719 302.163 134.213 297.82 134.213C289.529 134.213 282.966 131.497 278.129 126.065C274.378 121.917 272.503 115.744 272.503 107.547V75.6948H254.737V63.1022H272.503V43.843H286.568V63.1022H308.776V75.6948H286.568V108.287C286.568 112.633 287.259 115.596 288.641 117.176C290.615 119.645 293.823 120.88 298.265 120.88C301.324 120.88 303.891 120.584 305.963 119.991Z" fill="black" />
    <path d="M251.091 132.732L240.135 106.065H196.459L185.651 132.732H170.253L213.189 29.0282H223.553L266.488 132.732H251.091ZM218.371 53.4726L202.381 91.991H234.361L218.371 53.4726Z" fill="black" />
    <path d="M66.7621 30.2013C66.6842 14.5319 66.7621 1.27917 66.9179 0.733473C67.1517 0.0318587 68.5543 -0.202013 76.1903 0.187773V58.6557H66.84L66.7621 30.2013Z" fill="url(#paint0_linear_1_16)" />
    <path d="M0.842365 45.1691C-0.404344 43.9218 -0.404344 43.6099 1.7774 40.1019C3.10202 38.075 4.50457 36.4379 4.89417 36.4379C5.36169 36.4379 12.764 40.4916 21.4131 45.5589C30.14 50.5481 41.2046 56.8626 46.0356 59.5912C50.7886 62.2417 54.7625 64.9702 54.7625 65.4379C54.7625 65.9836 53.8275 67.9326 52.8145 69.7256C51.7237 71.5966 50.3211 73.0777 49.6978 73.0777C49.0744 73.0777 45.1005 71.1288 40.9708 68.7121C36.7632 66.2955 26.322 60.2928 17.7509 55.3815C9.17973 50.4702 1.54364 45.8707 0.842365 45.1691Z" fill="url(#paint1_linear_1_16)" />
    <path d="M112.033 50.8599C115.851 48.5992 123.098 44.4675 128.007 41.583C132.916 38.7766 137.435 36.5158 138.058 36.6717C138.682 36.7497 140.084 38.4648 143.201 44.2336L141.253 45.7927C140.162 46.5723 133.539 50.5481 126.448 54.6019C119.358 58.6557 109.306 64.4245 104.085 67.5428C98.7869 70.5831 93.8001 73.0777 92.943 73.0777C92.0859 73.0777 91.3846 72.61 91.3846 72.0643C91.3846 71.5966 90.6833 70.2713 89.8262 69.1799C88.9691 68.0885 88.3457 66.6853 88.4237 65.9836C88.5016 65.2041 92.0859 62.5535 96.761 59.825C101.358 57.0965 108.215 53.0427 112.033 50.8599Z" fill="url(#paint2_linear_1_16)" />
    <path d="M61.3857 80.0939C63.5674 78.9245 66.5284 77.2095 68.0088 76.274C69.4893 75.4165 70.9697 74.6369 71.3593 74.6369C71.671 74.6369 76.0345 76.9756 81.0993 79.86C86.0861 82.6665 92.3976 86.4084 95.1247 88.0455C97.774 89.6826 100.112 91.0079 100.345 91.0079C100.579 91.0079 104.475 93.1907 109.15 95.9192C113.747 98.6477 122.319 103.637 128.24 107.067C134.162 110.419 139.85 113.693 140.863 114.161C141.954 114.707 142.811 115.72 142.811 116.344C142.811 116.968 141.954 118.917 140.863 120.632C139.773 122.347 138.682 123.906 138.37 124.14C137.98 124.296 135.331 123.048 132.292 121.255C129.331 119.54 124.189 116.656 120.994 114.785C117.799 112.992 109.384 108.158 102.293 104.105C95.2026 99.973 85.7744 94.516 81.2551 91.8654C76.7358 89.2928 72.2165 87.11 71.1256 87.11C69.9568 87.11 68.788 87.4219 68.3984 87.8117C67.9309 88.2014 60.6065 92.567 52.0354 97.4783C43.4642 102.312 29.5946 110.341 21.2572 115.175C12.9199 120.008 5.59544 124.062 5.12793 124.218C4.58249 124.374 3.25786 123.048 2.16699 121.177C1.15404 119.384 0.21901 117.357 0.141091 116.578C0.141091 115.72 3.88122 113.148 12.0627 108.548C18.608 104.728 28.192 99.2714 33.3347 96.309C38.4774 93.3466 43.2305 90.6181 43.8538 90.2283C44.4772 89.8385 47.8277 87.8896 51.2562 85.8627C54.6846 83.8358 59.2819 81.2633 61.3857 80.0939Z" fill="url(#paint3_linear_1_16)" />
    <path d="M66.7621 131.935C66.6842 116.5 66.7621 103.403 66.9179 102.857C67.1517 102.156 68.5543 101.922 76.1903 102.312V160H66.84L66.7621 131.935Z" fill="url(#paint4_linear_1_16)" />
    <defs>
      <linearGradient id="paint0_linear_1_16" x1="143.167" y1="1.75503e-06" x2="97.6228" y2="184.181" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F18881" />
        <stop offset="1" stop-color="#FBC82F" />
      </linearGradient>
      <linearGradient id="paint1_linear_1_16" x1="143.167" y1="1.75503e-06" x2="97.6228" y2="184.181" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F18881" />
        <stop offset="1" stop-color="#FBC82F" />
      </linearGradient>
      <linearGradient id="paint2_linear_1_16" x1="143.167" y1="1.75503e-06" x2="97.6228" y2="184.181" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F18881" />
        <stop offset="1" stop-color="#FBC82F" />
      </linearGradient>
      <linearGradient id="paint3_linear_1_16" x1="143.167" y1="1.75503e-06" x2="97.6228" y2="184.181" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F18881" />
        <stop offset="1" stop-color="#FBC82F" />
      </linearGradient>
      <linearGradient id="paint4_linear_1_16" x1="143.167" y1="1.75503e-06" x2="97.6228" y2="184.181" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F18881" />
        <stop offset="1" stop-color="#FBC82F" />
      </linearGradient>
    </defs>
  </svg>
);

export default function Header() {
  let location = useLocation();
  const [{ searchVisibility }] = useContext(LayoutContext);
  const { loggedIn, user } = useContext(AuthContext);
  const { width } = useWindowSize();
  const [state, setState] = useState(false);
  const sidebarHandler = () => {
    setState(!state);
  };
  const headerType = location.pathname === '/' ? 'transparent' : 'default';
  let avatarImg = user?.avatar;
  if (avatarImg && typeof avatarImg === 'object' && avatarImg.url) {
    avatarImg = avatarImg.url;
  }
  if (!avatarImg) {
    avatarImg = '/images/favicon.png';
  }

  return (
    <HeaderWrapper>
      <Sticky
        top={headerType === 'transparent' ? -1 : 0}
        innerZ={500}
        activeClass="isHeaderSticky"
      >
        {width > 991 ? (
          <Navbar
            logo={
              <>
                {headerType === 'transparent' && <LogoIcon />}
                <Logo
                  withLink
                  linkTo="/"
                  src="/images/logo-ao.svg"
                  title="Atlasora"
                  className="logoscrollbar"
                />
              </>
            }
            navMenu={<MainMenu />}
            authMenu={<AuthMenu />}
            isLogin={loggedIn}
            avatar={<Logo src={avatarImg} />}
            profileMenu={<ProfileMenu avatar={<Logo src={avatarImg} />} />}
            headerType={headerType}
            searchComponent={<NavbarSearch />}
            location={location}
            searchVisibility={searchVisibility}
          />
        ) : (
          <MobileNavbar className={headerType}>
            <LogoArea>
              <>
                {headerType === 'transparent' && <LogoIcon />}
                {/*<Logo
                  withLink
                  linkTo="/"
                  src="/images/logo-ao.svg"
                  title="Atlasora"
                />*/}
              </>
              <NavbarSearch />
            </LogoArea>
            <Button
              className={`hamburg-btn ${state ? 'active' : ''}`}
              onClick={sidebarHandler}
            >
              <span />
              <span />
              <span />
            </Button>
            <Drawer
              placement="right"
              closable={false}
              onClose={sidebarHandler}
              width="285px"
              className="mobile-header"
              open={state}
            >
              <CloseDrawer>
                <button onClick={sidebarHandler}>
                  <IoIosClose />
                </button>
              </CloseDrawer>
              {loggedIn ? (
                <AvatarWrapper>
                  <AvatarImage>
                    <Logo src={avatarImg} />
                  </AvatarImage>
                  <AvatarInfo>
                    <Text as="h3" content="Atlasora" />
                    <TextLink link={AGENT_PROFILE_PAGE} content="View Profile" />
                  </AvatarInfo>
                </AvatarWrapper>
              ) : (
                <AuthMenu className="auth-menu" />
              )}
              <MobileMenu className="main-menu" />
            </Drawer>
          </MobileNavbar>
        )}
      </Sticky>
    </HeaderWrapper>
  );
}
