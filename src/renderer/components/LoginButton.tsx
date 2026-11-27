import { ArrowPathIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { FeedbackUiEvent } from '../../shared/feedback/constants';
import { EnterpriseAccountMenu } from '../features/enterpriseAccount/components/EnterpriseAccountMenu';
import { selectEnterpriseAccountContext } from '../features/enterpriseAccount/selectors';
import { authService } from '../services/auth';
import { BrowserLoginStatus } from '../services/browserLoginSession';
import { getPortalProfileUrl } from '../services/endpoints';
import { i18nService } from '../services/i18n';
import { RootState } from '../store';
import { AccountConnectionNotice } from './AccountConnectionNotice';
import { AccountConnectionState, getAccountConnectionState } from './accountConnectionState';
import { getAccountMenuDisplayName } from './accountMenuState';
import UserAvatarIcon from './icons/UserAvatarIcon';
import BrowserLoginStatusCard from './login/BrowserLoginStatusCard';
import { useBrowserLoginSession } from './login/useBrowserLoginSession';
import LogoutConfirmDialog from './LogoutConfirmDialog';

const LoginButton: React.FC = () => {
  const { isLoggedIn, isLoading, sessionStatus, profileSummary, user } = useSelector((state: RootState) => state.auth);
  const enterpriseAccountContext = useSelector(selectEnterpriseAccountContext);
  const connectionState = getAccountConnectionState({ isLoading, isLoggedIn, sessionStatus });
  const loginSession = useBrowserLoginSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const loginStartingRef = useRef(false);
  const [loginStarting, setLoginStarting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-app-modal], [data-enterprise-account-flyout]')) return;
      if (!containerRef.current?.contains(target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    setShowMenu(false);
  }, [isLoggedIn]);

  const handleLogin = async () => {
    if (loginStartingRef.current) return;
    loginStartingRef.current = true;
    setLoginStarting(true);
    try {
      await authService.login();
    } catch (error) {
      console.error('[LoginButton] login failed:', error);
    } finally {
      loginStartingRef.current = false;
      setLoginStarting(false);
    }
  };

  const handleClick = () => {
    if (isLoading) return;
    if (connectionState || isLoggedIn) {
      setShowMenu(current => !current);
      if (isLoggedIn && !enterpriseAccountContext) void authService.recoverAccount();
      return;
    }
    void handleLogin();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
      setShowMenu(false);
      setLogoutConfirmOpen(false);
    } catch (error) {
      console.error('[LoginButton] logout failed:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const loginSessionActive = !isLoggedIn && !connectionState && loginSession !== null;
  const loginOpening = loginStarting || (loginSessionActive && (
    loginSession.status === BrowserLoginStatus.Opening || loginSession.status === BrowserLoginStatus.Verifying
  ));
  const loginInProgress = loginOpening || (loginSessionActive && loginSession.status === BrowserLoginStatus.Waiting);
  const loginStatusCardVisible = loginSessionActive
    && (loginSession.status !== BrowserLoginStatus.Opening || loginSession.url !== null);
  const accountName = getAccountMenuDisplayName({
    fallback: i18nService.t('myAccount'),
    profileNickname: profileSummary?.nickname,
    userNickname: user?.nickname,
    userPhone: user?.phone,
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || loginOpening}
        aria-busy={isLoading || loginInProgress}
        title={connectionState
          ? i18nService.t(isLoading ? 'authRestoringSession' : 'authConnectionUnavailable')
          : undefined}
        className="inline-flex h-7 items-center justify-start gap-2 rounded-md px-1.5 text-sm font-normal text-foreground/80 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] disabled:opacity-60"
      >
        {user?.avatarUrl && isLoggedIn ? (
          <img src={user.avatarUrl} alt="" className="h-4 w-4 shrink-0 rounded-full" />
        ) : loginInProgress || connectionState === AccountConnectionState.Restoring ? (
          <ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <UserAvatarIcon className="h-4 w-4 shrink-0" />
        )}
        <span className="max-w-[80px] truncate">
          {isLoggedIn || connectionState
            ? i18nService.t('myAccount')
            : i18nService.t(loginInProgress ? 'browserLoginWaitingLabel' : 'login')}
        </span>
      </button>
      {loginStatusCardVisible && (
        <BrowserLoginStatusCard
          session={loginSession}
          onRetry={() => void handleLogin()}
          onDismiss={() => { void authService.cancelLogin(); }}
        />
      )}
      {showMenu && !isLoggedIn && connectionState && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-xl border border-border bg-surface p-3 shadow-popover">
          <AccountConnectionNotice state={connectionState} className="w-full text-xs" />
        </div>
      )}
      {showMenu && isLoggedIn && (enterpriseAccountContext ? (
        <EnterpriseAccountMenu context={enterpriseAccountContext} onClose={() => setShowMenu(false)} />
      ) : (
        <div className="absolute bottom-full left-[-0.5rem] z-50 mb-1 w-[14.5rem] rounded-xl border border-border bg-surface p-2 shadow-popover">
          <div className="truncate border-b border-border px-2 py-2 text-sm font-medium text-foreground">{accountName}</div>
          <button
            type="button"
            className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-surface-raised"
            onClick={() => { void window.electron.shell.openExternal(getPortalProfileUrl()); setShowMenu(false); }}
          >
            {i18nService.t('authUsageOverview')}
          </button>
          <button
            type="button"
            className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-surface-raised"
            onClick={() => { window.dispatchEvent(new Event(FeedbackUiEvent.Open)); setShowMenu(false); }}
          >
            {i18nService.t('feedbackTitle')}
          </button>
          <div className="border-t border-border pt-1">
            <button
              type="button"
              className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-surface-raised"
              onClick={() => setLogoutConfirmOpen(true)}
            >
              {i18nService.t('authLogout')}
            </button>
          </div>
        </div>
      ))}
      {logoutConfirmOpen && (
        <LogoutConfirmDialog
          isLoggingOut={loggingOut}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={() => void handleLogout()}
        />
      )}
    </div>
  );
};

export default LoginButton;
