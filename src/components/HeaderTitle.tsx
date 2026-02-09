'use client';

import { useRef, useEffect } from 'react';
import {
  initSuperuserTapGesture,
  initSuperuserKeyboardShortcut,
  initGlobalSuperuserHelper,
} from '@/lib/superuser-override';

export default function HeaderTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    initGlobalSuperuserHelper();
    const cleanupKeyboard = initSuperuserKeyboardShortcut();
    const cleanupTap = titleRef.current
      ? initSuperuserTapGesture(titleRef.current)
      : () => {};

    return () => {
      cleanupKeyboard();
      cleanupTap();
    };
  }, []);

  return (
    <h1
      ref={titleRef}
      className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 select-none cursor-default"
    >
      🇫🇷 French 1 Practice & Assessment
    </h1>
  );
}
