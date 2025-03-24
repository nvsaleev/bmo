import { useState, useEffect, useCallback } from 'react';

const useCommandK = () => {
  const [isPressed, setIsPressed] = useState(false);

  const handleKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      setIsPressed(true);
    }
  }, []);

  const handleKeyUp = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      setIsPressed(false);
    }
  }, []);

//   const resetPressed = useCallback(() => {
//     setIsPressed(false);
//   }, []);

  const handleEsc = useCallback((event) => {
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
  }, [handleKeyDown, handleKeyUp]);

  return [isPressed, setIsPressed];
};

export default useCommandK;