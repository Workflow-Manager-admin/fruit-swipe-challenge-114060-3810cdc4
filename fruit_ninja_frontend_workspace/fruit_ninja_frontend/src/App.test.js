import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders Fruit Ninja title and main controls', () => {
  render(<App />);
  // Check for Fruit Ninja title
  const title = screen.getByText(/Fruit/i);
  expect(title).toBeInTheDocument();

  // Start screen must have Start Game button
  const startBtn = screen.getByRole('button', { name: /Start Game/i });
  expect(startBtn).toBeInTheDocument();

  // Classic and Timer mode buttons must be present
  expect(screen.getByRole('button', { name: /Classic/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Timer/i })).toBeInTheDocument();
});

test('starts the game and displays scorebar', () => {
  render(<App />);
  // Click start
  const startBtn = screen.getByRole('button', { name: /Start Game/i });
  fireEvent.click(startBtn);

  // Game should display scorebar and pause button
  expect(screen.getByText(/Score:/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
});
