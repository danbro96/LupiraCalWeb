import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

type Severity = 'error' | 'success' | 'info';

const SnackbarContext = createContext<(message: string, severity?: Severity) => void>(() => {});

/** Transient mutation feedback (errors mostly); field-level validation stays inline next to its input. */
export function useSnackbar() {
  return useContext(SnackbarContext);
}

export function SnackbarHost({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ message: string; severity: Severity; key: number } | null>(null);
  const show = useCallback((message: string, severity: Severity = 'error') => {
    setCurrent({ message, severity, key: Date.now() });
  }, []);
  const value = useMemo(() => show, [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={current != null}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setCurrent(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {current ? (
          <Alert severity={current.severity} variant="filled" onClose={() => setCurrent(null)}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
