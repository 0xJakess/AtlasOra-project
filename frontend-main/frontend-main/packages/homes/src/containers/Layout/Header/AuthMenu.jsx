import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, Space, Dropdown, Avatar } from 'antd';
import { AuthContext } from 'context/AuthProvider';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { LOGIN_PAGE, REGISTRATION_PAGE, AGENT_ACCOUNT_SETTINGS_PAGE } from 'settings/constant';

const AuthMenu = ({ className }) => {
	const { loggedIn, user, logOut } = useContext(AuthContext);
	const navigate = useNavigate();

	// If not logged in, show sign in/sign up
	if (!loggedIn) {
		const menuItems = [
			{ label: <NavLink to={LOGIN_PAGE}>Sign in</NavLink>, key: 'menu-1' },
			{ label: <NavLink to={REGISTRATION_PAGE}>Sign up</NavLink>, key: 'menu-2' },
		];
		return <Menu className={className} items={menuItems} />;
	}

	// If logged in, show user menu
	const userMenuItems = [
		{
			key: 'user-info',
			label: (
				<Space>
					<UserOutlined />
					<span>{user?.username || user?.email || 'User'}</span>
				</Space>
			),
			disabled: true,
		},
		{ type: 'divider' },
		{
			key: 'settings',
			label: (
				<Space onClick={() => navigate(AGENT_ACCOUNT_SETTINGS_PAGE)}>
					<SettingOutlined />
					<span>Account Settings</span>
				</Space>
			),
		},
		{
			key: 'logout',
			label: (
				<Space onClick={() => logOut()}>
					<LogoutOutlined />
					<span>Sign Out</span>
				</Space>
			),
		},
	];

	return (
		<Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
			<Avatar
				icon={<UserOutlined />}
				style={{
					background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
					cursor: 'pointer',
					border: '2px solid #fff',
				}}
			/>
		</Dropdown>
	);
};

export default AuthMenu;
