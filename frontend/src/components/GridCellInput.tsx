import React, { useEffect, useRef, useState } from "react";
import { TextInput, TextInputProps, StyleProp, TextStyle } from "react-native";

/**
 * Self-managed TextInput. Holds its own state to avoid the
 * "cursor jump" caused by re-renders during fast typing.
 * Commits the value to parent on blur (or after a debounce).
 */
interface Props extends Omit<TextInputProps, "value" | "onChangeText" | "onBlur"> {
  initialValue: string;
  onCommit: (value: string) => void;
  style?: StyleProp<TextStyle>;
  // optional formatter for displayed value (e.g. thousand separators)
  format?: (raw: string) => string;
  // sanitizer for raw value (e.g. numeric-only)
  sanitize?: (raw: string) => string;
}

export const GridCellInput: React.FC<Props> = ({
  initialValue,
  onCommit,
  format,
  sanitize,
  style,
  ...rest
}) => {
  const [val, setVal] = useState<string>(initialValue ?? "");
  const lastInitial = useRef<string>(initialValue ?? "");

  // Sync ONLY when the external value actually changes (and we're not editing)
  useEffect(() => {
    if ((initialValue ?? "") !== lastInitial.current) {
      lastInitial.current = initialValue ?? "";
      setVal(initialValue ?? "");
    }
  }, [initialValue]);

  const display = format ? format(val) : val;

  return (
    <TextInput
      {...rest}
      style={style}
      value={display}
      onChangeText={(t) => {
        const raw = sanitize ? sanitize(t) : t;
        setVal(raw);
      }}
      onBlur={() => {
        if (val !== lastInitial.current) {
          lastInitial.current = val;
          onCommit(val);
        }
      }}
      onEndEditing={() => {
        if (val !== lastInitial.current) {
          lastInitial.current = val;
          onCommit(val);
        }
      }}
    />
  );
};

export const formatThousands = (raw: string) => {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const sanitizeDigits = (raw: string) => raw.replace(/[^0-9]/g, "");
