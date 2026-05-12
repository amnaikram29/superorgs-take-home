import { Box, Stat } from '@chakra-ui/react';
import { useColorMode } from '../ui/color-mode';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { KpiResult } from '../../api/types';

interface Props {
  data: KpiResult;
}

export default function KpiRenderer({ data }: Props) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const bg = isDark ? '#2d3748' : 'white';
  const border = isDark ? '#4a5568' : '#e2e8f0';

  const deltaColor =
    data.delta_direction === 'up'
      ? 'green.500'
      : data.delta_direction === 'down'
      ? 'red.500'
      : 'gray.500';

  return (
    <Box
      display="inline-block"
      bg={bg}
      border="1px solid"
      borderColor={border}
      borderRadius="lg"
      px={5}
      py={4}
      minW="160px"
    >
      <Stat.Root>
        <Stat.Label fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          {data.label}
        </Stat.Label>
        <Stat.ValueText fontSize="2xl" fontWeight="700" mt={1}>
          {data.value}
        </Stat.ValueText>
        {data.delta && (
          <Stat.HelpText mb={0} mt={1} color={deltaColor}>
            {data.delta_direction === 'up' && <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />}
            {data.delta_direction === 'down' && <TrendingDown size={12} style={{ display: 'inline', marginRight: 4 }} />}
            {data.delta}
          </Stat.HelpText>
        )}
      </Stat.Root>
    </Box>
  );
}
