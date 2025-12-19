import React, { useContext } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Row, Col, Menu, Avatar } from 'antd';
import Container from 'components/UI/Container/Container.style';
import {
  AGENT_PROFILE_PAGE,
  AGENT_IMAGE_EDIT_PAGE,
  AGENT_PASSWORD_CHANGE_PAGE,
  AGENT_ACCOUNT_SETTINGS_PAGE,
} from 'settings/constant';
import AccountSettingWrapper, {
  AccountSidebar,
  AgentAvatar,
  SidebarMenuWrapper,
  ContentWrapper,
  AgentName,
  FromWrapper,
} from './AccountSettings.style';
import AuthProvider, { AuthContext } from 'context/AuthProvider';

const navigations = [
  {
    label: <NavLink to={AGENT_ACCOUNT_SETTINGS_PAGE}>Edit Profile</NavLink>,
    key: 'edit_profile',
  },
  //todo : post mvp image fixer
  //{
  //  label: <NavLink to={AGENT_IMAGE_EDIT_PAGE}>Change Photos</NavLink>,
  //  key: 'change_photos',
  // },
  {
    label: <NavLink to={AGENT_PASSWORD_CHANGE_PAGE}>Change Password</NavLink>,
    key: 'change_password',
  },
];

function AccountSettingNavLink() {
  return (
    <SidebarMenuWrapper>
      <Menu
        defaultSelectedKeys={['0']}
        defaultOpenKeys={['edit_profile']}
        mode="inline"
        items={navigations}
      />
    </SidebarMenuWrapper>
  );
}

export default function AgentAccountSettingsPage() {
  const { loggedIn } = useContext(AuthContext);
  if (!loggedIn) {
    let navigate = useNavigate();
    navigate('/sign-in');
    return;
  }

  const { user: userInfo } = useContext(AuthContext);

  if (!userInfo) return <Loader />;

  const { FirstName, SecondName, avatar, Twitter, Facebook, Instagram, Bio } =
    userInfo;
  console.log('avatar', avatar);
  return (
    <AccountSettingWrapper>
      <Container fullWidth={true}>
        <Row gutter={30}>
          <Col xs={24} sm={12} md={9} lg={6}>
            <AccountSidebar>
              <AgentAvatar>
                <Avatar src={avatar} alt="avatar" />
                <ContentWrapper>
                  <AgentName>
                    {FirstName} {SecondName}
                  </AgentName>
                  <Link to={AGENT_PROFILE_PAGE}>View profile</Link>
                </ContentWrapper>
              </AgentAvatar>
              <AccountSettingNavLink />
            </AccountSidebar>
          </Col>
          <Col xs={24} sm={12} md={15} lg={18}>
            <FromWrapper>
              <Outlet />
            </FromWrapper>
          </Col>
        </Row>
      </Container>
    </AccountSettingWrapper>
  );
}
