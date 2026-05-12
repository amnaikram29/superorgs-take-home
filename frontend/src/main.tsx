import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { ColorModeProvider } from './components/ui/color-mode';
import App from './App';
import { system } from './theme';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="light" enableSystem={false}>
        <App />
      </ColorModeProvider>
    </ChakraProvider>
  </StrictMode>,
);
