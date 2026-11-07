import { GOOGLE_CLIENT_ID } from '../config';

/**
 * Initiates the official Google Cloud OAuth 2.0 popup sign-in flow.
 * Works seamlessly across mobile and desktop.
 */
export function initiateGoogleSignIn({ onSuccess, onError }) {
    if (typeof window === 'undefined' || !window.google?.accounts) {
        if (onError) onError('Google Sign-In service is loading. Please try again in a moment.');
        return;
    }

    try {
        if (window.google.accounts.oauth2) {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile openid',
                callback: async (tokenResponse) => {
                    if (tokenResponse.error) {
                        if (onError) onError('Google Sign-In cancelled.');
                        return;
                    }
                    try {
                        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                        });
                        const profile = await userInfoRes.json();
                        if (onSuccess) onSuccess(profile);
                    } catch (err) {
                        if (onError) onError('Failed to retrieve user profile from Google.');
                    }
                }
            });
            client.requestAccessToken();
        } else if (window.google.accounts.id) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    if (response.credential && onSuccess) {
                        onSuccess({ credential: response.credential });
                    }
                }
            });
            window.google.accounts.id.prompt();
        }
    } catch (err) {
        console.error('Google Sign-In Exception:', err);
        if (onError) onError(err.message || 'Google Sign-In failed.');
    }
}
