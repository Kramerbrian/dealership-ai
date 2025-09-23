#!/usr/bin/env python3
"""
Advanced Session Management for AI Platform Testing
Handles authentication, cookies, rate limits, and session persistence
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import pickle
import hashlib
import aiofiles
from pathlib import Path

class SessionState(Enum):
    UNINITIALIZED = "uninitialized"
    INITIALIZING = "initializing"
    ACTIVE = "active"
    RATE_LIMITED = "rate_limited"
    EXPIRED = "expired"
    BLOCKED = "blocked"
    ERROR = "error"

@dataclass
class SessionData:
    platform: str
    session_id: str
    cookies: List[Dict]
    local_storage: Dict[str, Any]
    session_storage: Dict[str, Any]
    auth_tokens: Dict[str, str]
    user_agent: str
    viewport: Dict[str, int]
    state: SessionState
    created_at: datetime
    expires_at: datetime
    last_activity: datetime
    rate_limit_reset: Optional[datetime]
    request_count: int
    max_requests_per_hour: int
    fingerprint: str

class SessionManager:
    def __init__(self, storage_path: str = "sessions"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(exist_ok=True)
        self.active_sessions: Dict[str, SessionData] = {}
        self.session_locks: Dict[str, asyncio.Lock] = {}

        # Platform-specific session configurations
        self.platform_configs = {
            "chatgpt": {
                "requires_auth": True,
                "max_requests_per_hour": 50,
                "session_lifetime_hours": 24,
                "rate_limit_detection": [
                    "You've reached your limit",
                    "Too many requests",
                    "Rate limit exceeded"
                ],
                "auth_indicators": [
                    "button[data-testid='login-button']",
                    "a[href*='login']"
                ],
                "session_indicators": [
                    "button[data-testid='send-button']",
                    "textarea[placeholder*='Message']"
                ]
            },
            "searchgpt": {
                "requires_auth": True,
                "max_requests_per_hour": 30,
                "session_lifetime_hours": 12,
                "rate_limit_detection": [
                    "Search limit reached",
                    "Please wait before searching",
                    "Too many searches"
                ],
                "auth_indicators": [
                    "button[data-testid='login']"
                ],
                "session_indicators": [
                    "input[placeholder*='Search']"
                ]
            },
            "gemini": {
                "requires_auth": False,
                "max_requests_per_hour": 100,
                "session_lifetime_hours": 8,
                "rate_limit_detection": [
                    "Daily limit exceeded",
                    "Too many requests"
                ],
                "auth_indicators": [
                    "button[data-testid='sign-in']"
                ],
                "session_indicators": [
                    "rich-textarea div[contenteditable='true']"
                ]
            },
            "perplexity": {
                "requires_auth": False,
                "max_requests_per_hour": 25,
                "session_lifetime_hours": 6,
                "rate_limit_detection": [
                    "You've reached the limit",
                    "Please wait",
                    "Rate limited"
                ],
                "auth_indicators": [
                    "button[data-testid='login']"
                ],
                "session_indicators": [
                    "textarea[placeholder*='Ask anything']"
                ]
            }
        }

    async def get_session(self, platform: str, force_new: bool = False) -> SessionData:
        """
        Get or create a session for the specified platform
        """

        # Ensure we have a lock for this platform
        if platform not in self.session_locks:
            self.session_locks[platform] = asyncio.Lock()

        async with self.session_locks[platform]:
            # Check if we have an active session
            if not force_new and platform in self.active_sessions:
                session = self.active_sessions[platform]

                # Validate session is still usable
                if await self._validate_session(session):
                    await self._update_session_activity(session)
                    return session
                else:
                    # Session invalid, remove it
                    del self.active_sessions[platform]

            # Try to restore from storage
            if not force_new:
                restored_session = await self._restore_session(platform)
                if restored_session and await self._validate_session(restored_session):
                    self.active_sessions[platform] = restored_session
                    return restored_session

            # Create new session
            new_session = await self._create_new_session(platform)
            self.active_sessions[platform] = new_session
            await self._persist_session(new_session)

            return new_session

    async def _create_new_session(self, platform: str) -> SessionData:
        """
        Create a new session for the platform
        """

        config = self.platform_configs.get(platform, {})
        session_id = self._generate_session_id(platform)

        session = SessionData(
            platform=platform,
            session_id=session_id,
            cookies=[],
            local_storage={},
            session_storage={},
            auth_tokens={},
            user_agent=self._generate_user_agent(),
            viewport={"width": 1920, "height": 1080},
            state=SessionState.UNINITIALIZED,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=config.get("session_lifetime_hours", 24)),
            last_activity=datetime.now(),
            rate_limit_reset=None,
            request_count=0,
            max_requests_per_hour=config.get("max_requests_per_hour", 60),
            fingerprint=self._generate_fingerprint(platform)
        )

        # Initialize the session
        await self._initialize_session(session)

        return session

    async def _initialize_session(self, session: SessionData):
        """
        Initialize a session by navigating to platform and handling auth
        """

        session.state = SessionState.INITIALIZING

        platform_urls = {
            "chatgpt": "https://chatgpt.com",
            "searchgpt": "https://chatgpt.com/?model=search",
            "gemini": "https://gemini.google.com",
            "perplexity": "https://www.perplexity.ai"
        }

        url = platform_urls.get(session.platform)
        if not url:
            raise ValueError(f"Unknown platform: {session.platform}")

        # Computer Use initialization
        init_prompt = f"""
        Initialize session for {session.platform}:

        1. NAVIGATION:
           - Navigate to {url}
           - Take screenshot of initial page
           - Handle any cookie banners/popups
           - Set viewport to {session.viewport['width']}x{session.viewport['height']}

        2. SESSION SETUP:
           - Apply user agent: {session.user_agent}
           - Set any required headers
           - Handle GDPR/privacy banners

        3. AUTHENTICATION CHECK:
           - Look for login indicators: {self.platform_configs[session.platform].get('auth_indicators', [])}
           - If login required, attempt authentication
           - If anonymous access available, proceed without auth

        4. SESSION VALIDATION:
           - Verify session is ready by finding: {self.platform_configs[session.platform].get('session_indicators', [])}
           - Take final screenshot
           - Extract any session cookies/tokens

        5. FINGERPRINTING:
           - Record any unique session identifiers
           - Note any rate limit warnings
           - Document session capabilities

        Return session initialization status and any extracted data.
        """

        try:
            # Execute initialization through Computer Use
            init_result = await self._execute_computer_action(init_prompt)

            # Process initialization results
            await self._process_session_init_result(session, init_result)

            session.state = SessionState.ACTIVE
            session.last_activity = datetime.now()

        except Exception as e:
            session.state = SessionState.ERROR
            raise Exception(f"Session initialization failed for {session.platform}: {e}")

    async def _execute_computer_action(self, prompt: str) -> Dict:
        """
        Execute Computer Use action and return structured result
        """
        # This would integrate with your Anthropic client
        # Placeholder for actual Computer Use implementation
        return {
            "status": "success",
            "screenshots": [],
            "extracted_data": {},
            "session_cookies": [],
            "errors": []
        }

    async def _process_session_init_result(self, session: SessionData, result: Dict):
        """
        Process session initialization results and update session data
        """

        if result.get("status") == "success":
            # Extract cookies
            session.cookies = result.get("session_cookies", [])

            # Extract any auth tokens
            extracted_data = result.get("extracted_data", {})
            session.auth_tokens = extracted_data.get("auth_tokens", {})

            # Update local/session storage
            session.local_storage = extracted_data.get("local_storage", {})
            session.session_storage = extracted_data.get("session_storage", {})

        else:
            errors = result.get("errors", [])
            raise Exception(f"Session initialization failed: {errors}")

    async def _validate_session(self, session: SessionData) -> bool:
        """
        Validate that a session is still active and usable
        """

        # Check expiration
        if datetime.now() > session.expires_at:
            return False

        # Check rate limit status
        if session.state == SessionState.RATE_LIMITED:
            if session.rate_limit_reset and datetime.now() < session.rate_limit_reset:
                return False
            else:
                # Rate limit should be reset
                session.state = SessionState.ACTIVE
                session.request_count = 0

        # Check if blocked
        if session.state == SessionState.BLOCKED:
            return False

        # Validate session is actually active (could do a quick test query)
        return await self._test_session_connectivity(session)

    async def _test_session_connectivity(self, session: SessionData) -> bool:
        """
        Test if session is actually responsive
        """

        connectivity_test = f"""
        Test session connectivity for {session.platform}:

        1. Take screenshot of current page
        2. Verify session indicators are present: {self.platform_configs[session.platform].get('session_indicators', [])}
        3. Check for any error messages or blocks
        4. Return connectivity status

        Quick test - do not make any queries, just verify UI is accessible.
        """

        try:
            result = await self._execute_computer_action(connectivity_test)
            return result.get("status") == "success"
        except:
            return False

    async def _update_session_activity(self, session: SessionData):
        """
        Update session activity tracking
        """

        session.last_activity = datetime.now()
        session.request_count += 1

        # Check rate limits
        if session.request_count >= session.max_requests_per_hour:
            session.state = SessionState.RATE_LIMITED
            session.rate_limit_reset = datetime.now() + timedelta(hours=1)

        # Persist updates
        await self._persist_session(session)

    async def handle_rate_limit(self, session: SessionData, detected_message: str = None):
        """
        Handle rate limiting for a session
        """

        session.state = SessionState.RATE_LIMITED

        # Platform-specific rate limit handling
        if session.platform == "chatgpt":
            # ChatGPT Plus vs Free have different limits
            wait_time = 3600 if "hour" in (detected_message or "") else 1800
        elif session.platform == "searchgpt":
            # SearchGPT has stricter limits
            wait_time = 7200
        elif session.platform == "gemini":
            # Gemini daily limits
            wait_time = 86400 if "daily" in (detected_message or "") else 3600
        elif session.platform == "perplexity":
            # Perplexity anonymous limits
            wait_time = 3600
        else:
            wait_time = 3600  # Default 1 hour

        session.rate_limit_reset = datetime.now() + timedelta(seconds=wait_time)

        await self._persist_session(session)

        return {
            "wait_time": wait_time,
            "reset_time": session.rate_limit_reset,
            "message": f"Rate limited on {session.platform}. Reset at {session.rate_limit_reset}"
        }

    async def handle_authentication_required(self, session: SessionData):
        """
        Handle authentication when required
        """

        auth_prompt = f"""
        Handle authentication for {session.platform}:

        1. DETECT AUTH REQUIREMENT:
           - Look for login buttons/forms
           - Check current page URL for auth redirects
           - Identify authentication type needed

        2. AUTHENTICATION STRATEGY:
           Platform: {session.platform}

           If ChatGPT/SearchGPT:
           - Look for "Log in" or "Sign up" buttons
           - Note: You may need to handle OAuth flow
           - Check for existing session cookies

           If Gemini:
           - Look for Google Sign-in
           - May work without auth but with limits

           If Perplexity:
           - Often works anonymously
           - Premium features require auth

        3. EXECUTE AUTH (if credentials available):
           - Use stored credentials if available
           - Handle multi-factor authentication
           - Store resulting auth tokens/cookies

        4. FALLBACK STRATEGIES:
           - Try anonymous access if supported
           - Use existing session restoration
           - Report auth requirements for manual handling

        Document authentication status and any tokens obtained.
        """

        try:
            auth_result = await self._execute_computer_action(auth_prompt)

            if auth_result.get("status") == "success":
                # Update session with auth data
                session.auth_tokens.update(auth_result.get("auth_tokens", {}))
                session.cookies.extend(auth_result.get("cookies", []))
                session.state = SessionState.ACTIVE

                await self._persist_session(session)
                return True
            else:
                session.state = SessionState.ERROR
                return False

        except Exception as e:
            session.state = SessionState.ERROR
            raise Exception(f"Authentication failed for {session.platform}: {e}")

    async def _persist_session(self, session: SessionData):
        """
        Persist session data to storage
        """

        session_file = self.storage_path / f"{session.platform}_{session.session_id}.pkl"

        async with aiofiles.open(session_file, 'wb') as f:
            await f.write(pickle.dumps(asdict(session)))

    async def _restore_session(self, platform: str) -> Optional[SessionData]:
        """
        Restore session from storage
        """

        # Find most recent session file for platform
        session_files = list(self.storage_path.glob(f"{platform}_*.pkl"))
        if not session_files:
            return None

        # Get most recent
        latest_file = max(session_files, key=lambda p: p.stat().st_mtime)

        try:
            async with aiofiles.open(latest_file, 'rb') as f:
                session_data = pickle.loads(await f.read())
                return SessionData(**session_data)
        except Exception:
            return None

    def _generate_session_id(self, platform: str) -> str:
        """Generate unique session ID"""
        timestamp = str(int(time.time()))
        platform_hash = hashlib.md5(platform.encode()).hexdigest()[:8]
        return f"{platform}_{timestamp}_{platform_hash}"

    def _generate_user_agent(self) -> str:
        """Generate realistic user agent"""
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    def _generate_fingerprint(self, platform: str) -> str:
        """Generate session fingerprint for tracking"""
        data = f"{platform}_{datetime.now()}_{id(self)}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    async def cleanup_expired_sessions(self):
        """
        Clean up expired sessions from memory and storage
        """

        current_time = datetime.now()

        # Clean up active sessions
        expired_platforms = []
        for platform, session in self.active_sessions.items():
            if current_time > session.expires_at:
                expired_platforms.append(platform)

        for platform in expired_platforms:
            del self.active_sessions[platform]

        # Clean up storage files older than 7 days
        cutoff_time = current_time - timedelta(days=7)

        for session_file in self.storage_path.glob("*.pkl"):
            if datetime.fromtimestamp(session_file.stat().st_mtime) < cutoff_time:
                session_file.unlink()

    async def get_session_stats(self) -> Dict:
        """
        Get statistics about current sessions
        """

        stats = {}

        for platform, session in self.active_sessions.items():
            stats[platform] = {
                "state": session.state.value,
                "created_at": session.created_at.isoformat(),
                "last_activity": session.last_activity.isoformat(),
                "request_count": session.request_count,
                "rate_limit_reset": session.rate_limit_reset.isoformat() if session.rate_limit_reset else None,
                "expires_at": session.expires_at.isoformat()
            }

        return stats

# Usage example
async def main():
    session_manager = SessionManager()

    # Get a ChatGPT session
    chatgpt_session = await session_manager.get_session("chatgpt")
    print(f"ChatGPT session state: {chatgpt_session.state}")

    # Get session stats
    stats = await session_manager.get_session_stats()
    print(f"Session stats: {stats}")

if __name__ == "__main__":
    asyncio.run(main())