import { Box, Stat } from '@chakra-ui/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useColorMode } from '../ui/color-mode';
import type { KpiResult } from '../../api/types';

interface Props { data: KpiResult }

export default function KpiRenderer({ data }: Props) {
  const { colorMode } = useColorMode();
  const d = colorMode === 'dark';

  const bg         = d ? '#1e2533' : '#ffffff';
  const border     = d ? '#2d3748' : '#e2e8f0';
  const labelColor = d ? '#718096' : '#718096';
  const valueColor = d ? '#ffffff' : '#1a202c';

  const deltaColor =
    data.delta_direction === 'up'   ? '#38a169' :
    data.delta_direction === 'down' ? '#e53e3e' :
    '#718096';

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
        <Stat.Label fontSize="xs" color={labelColor} textTransform="uppercase" letterSpacing="wider">
          {data.label}
        </Stat.Label>
        <Stat.ValueText fontSize="2xl" fontWeight="700" mt={1} color={valueColor}>
          {data.value}
        </Stat.ValueText>
        {data.delta && (
          <Stat.HelpText mb={0} mt={1} color={deltaColor} display="flex" alignItems="center" gap={1}>
            {data.delta_direction === 'up'   && <TrendingUp size={12} />}
            {data.delta_direction === 'down' && <TrendingDown size={12} />}
            {data.delta}
          </Stat.HelpText>
        )}
      </Stat.Root>
    </Box>
  );
}
