import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  timeout: number; // timeout in milliseconds
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ timeout }) => {
  // Counts towards a fixed deadline instead of subtracting a second per tick: browsers throttle
  // timers in background tabs, and the display would fall behind the time actually left.
  const [deadline] = useState(() => Date.now() + timeout);
  const [timeLeft, setTimeLeft] = useState<number>(timeout);

  useEffect(() => {
    const timerId = setInterval(() => {
      const newTime = Math.max(deadline - Date.now(), 0);
      setTimeLeft(newTime);
      if (newTime === 0) {
        clearInterval(timerId);
      }
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [deadline]);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return <span>{formatTime(timeLeft)}</span>;
};

export default CountdownTimer;
