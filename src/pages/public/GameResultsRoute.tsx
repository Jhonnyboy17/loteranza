import { useParams } from 'react-router-dom';
import { GameResultsPage } from './ResultsPage';

export function GameResultsRoute() {
  const { gameKey } = useParams<{ gameKey: string }>();
  return <GameResultsPage gameKey={gameKey ?? ''} />;
}
