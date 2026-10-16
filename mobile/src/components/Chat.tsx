import React, { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ChatMessage } from '../types';
import { colors, radius } from '../theme';

interface Props {
  messages: ChatMessage[];
  viewerId: string | null;
  onSend: (body: string) => void;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "Stamtafel" — the regulars' table chat.
export function Chat({ messages, viewerId, onSend }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const renderItem = ({ item: m }: { item: ChatMessage }) => {
    if (m.kind === 'system') {
      return <Text style={styles.system}>— {m.body} —</Text>;
    }
    const mine = m.player_id === viewerId;
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <Text style={styles.meta}>
          <Text style={styles.name}>{m.name}</Text> {timeOf(m.created_at)}
        </Text>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>{m.body}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stamtafel</Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>Nog stil aan tafel…</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Zeg iets…"
          placeholderTextColor={colors.muted}
          maxLength={500}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={submit}
        />
        <Pressable style={styles.sendBtn} onPress={submit}>
          <Text style={styles.sendText}>Stuur</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  header: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,143,61,0.25)',
  },
  title: { fontSize: 20, color: colors.goldSoft, fontWeight: '700' },
  list: { padding: 12, gap: 8, flexGrow: 1 },
  row: { maxWidth: '88%', gap: 2 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  meta: { fontSize: 11, color: 'rgba(247,242,230,0.5)' },
  name: { fontWeight: '700', color: colors.gold },
  bubble: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.gold },
  bubbleTheirs: { backgroundColor: 'rgba(247,242,230,0.08)' },
  bubbleText: { color: colors.parchment, fontSize: 14, lineHeight: 19 },
  bubbleTextMine: { color: '#3a2408', fontSize: 14, lineHeight: 19 },
  system: {
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.goldSoft,
    opacity: 0.85,
  },
  empty: { color: 'rgba(247,242,230,0.4)', fontSize: 14, textAlign: 'center', marginTop: 20 },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,143,61,0.25)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(247,242,230,0.2)',
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    color: colors.parchment,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendText: { color: '#3a2408', fontWeight: '700' },
});
