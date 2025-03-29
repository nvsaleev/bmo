import { useState, useEffect, useCallback } from 'react';

export default function useCommandK(){

  const [isPressed, setIsPressed] = useState(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      setIsPressed(true);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      setIsPressed(false);
    }
  }, []);


  const handleEsc = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        setIsPressed(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [handleKeyDown, handleKeyUp, handleEsc]);

  return [isPressed, setIsPressed];
};