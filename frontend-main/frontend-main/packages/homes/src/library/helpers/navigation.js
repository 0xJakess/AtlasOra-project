import { useNavigate, useLocation } from 'react-router-dom';

// Hook to navigate to sign-in page with redirect state
export const useAuthNavigation = () => {
	const navigate = useNavigate();
	const location = useLocation();

	const navigateToSignIn = () => {
		navigate('/sign-in', {
			state: { from: location.pathname }
		});
	};

	return { navigateToSignIn };
};

// Utility function to check if a path is internal to the app
export const isInternalPath = (path) => {
	return path && path.startsWith('/') && !path.startsWith('//');
};

// Utility function to get safe redirect path
export const getSafeRedirectPath = (path, fallback = '/') => {
	if (isInternalPath(path)) {
		return path;
	}
	return fallback;
}; 