import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader,
  Paperclip,
  Send,
  MessageSquare,
  FileText,
  Check,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

type Role = "doctor" | "patient";

interface Conversation {
  id: string;
  patient_id: string;
  medecin_id: string;
  last_message_at: string | null;
  created_at: string;
  other_name: string;
  other_role: string;
  last_message_preview: string | null;
  unread_count: number;
}

interface PatientOption {
  id: string;
  name: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  read: boolean;
  created_at: string;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
}

const TYPING_DEBOUNCE_MS = 2000;

export default function Messagerie({
  role,
  dossierLink,
}: {
  role: Role;
  dossierLink?: string;
}) {
  const [searchParams] = useSearchParams();
  const initialConvId = searchParams.get("conversation");
  const [userId, setUserId] = useState<string | null>(null);
  const [patientRowId, setPatientRowId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [patientsToStart, setPatientsToStart] = useState<PatientOption[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConvId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [otherTyping, setOtherTyping] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      if (role === "patient") {
        const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).single();
        if (p) setPatientRowId((p as any).id);
      }
    })();
  }, [role]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoadingConversations(true);
      if (role === "doctor") {
        const { data: patientsData, error: patientsErr } = await supabase
          .from("patients")
          .select("id, user_id, utilisateurs!patients_user_id_fkey(nom, prenom)")
          .eq("medecin_id", userId);
        if (patientsErr) console.warn("Messagerie: patients load", patientsErr);
        const allPatients: PatientOption[] = (patientsData || []).map((p: any) => {
          const u = Array.isArray(p.utilisateurs) ? p.utilisateurs[0] : p.utilisateurs;
          const name = [u?.prenom, u?.nom].filter(Boolean).join(" ") || "Patient";
          return { id: p.id, name };
        });

        const { data: convData } = await supabase
          .from("conversations")
          .select("id, patient_id, medecin_id, last_message_at, created_at, patients!inner(utilisateurs!patients_user_id_fkey(nom, prenom))")
          .eq("medecin_id", userId)
          .order("last_message_at", { ascending: false });

        const convPatientIds = new Set((convData || []).map((c: any) => c.patient_id));
        setPatientsToStart(allPatients.filter((p) => !convPatientIds.has(p.id)));

        if (convData?.length) {
          const convIds = convData.map((c: any) => c.id);
          const { data: unreadData } = await supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("read", false)
            .neq("sender_id", userId);
          const unreadByConv: Record<string, number> = {};
          (unreadData || []).forEach((r: any) => {
            unreadByConv[r.conversation_id] = (unreadByConv[r.conversation_id] || 0) + 1;
          });
          const { data: lastMsgs } = await supabase
            .from("messages")
            .select("conversation_id, content")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: false });
          const lastByConv: Record<string, string> = {};
          (lastMsgs || []).forEach((m: any) => {
            if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = (m.content || "").slice(0, 40);
          });
          const getPatientName = (c: any) => {
            const p = Array.isArray(c.patients) ? c.patients[0] : c.patients;
            const u = p?.utilisateurs;
            return [u?.prenom, u?.nom].filter(Boolean).join(" ") || "Patient";
          };
          setConversations(
            convData.map((c: any) => ({
              id: c.id,
              patient_id: c.patient_id,
              medecin_id: c.medecin_id,
              last_message_at: c.last_message_at,
              created_at: c.created_at,
              other_name: getPatientName(c),
              other_role: "Patient",
              last_message_preview: lastByConv[c.id] || null,
              unread_count: unreadByConv[c.id] || 0,
            }))
          );
        } else {
          setConversations([]);
        }
      } else {
        if (!patientRowId) {
          setConversations([]);
          setLoadingConversations(false);
          return;
        }
        const { data: convData } = await supabase
          .from("conversations")
          .select("id, patient_id, medecin_id, last_message_at, created_at")
          .eq("patient_id", patientRowId)
          .order("last_message_at", { ascending: false });
        if (!convData?.length) {
          setConversations([]);
          setLoadingConversations(false);
          return;
        }
        const medecinIds = [...new Set(convData.map((c: any) => c.medecin_id))];
        const { data: utilData } = await supabase.from("utilisateurs").select("id, nom, prenom").in("id", medecinIds);
        const nameByMed: Record<string, string> = {};
        (utilData || []).forEach((u: any) => {
          nameByMed[u.id] = [u.prenom, u.nom].filter(Boolean).join(" ") || "Médecin";
        });
        const convIds = convData.map((c: any) => c.id);
        const { data: unreadData } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .eq("read", false)
          .neq("sender_id", userId);
        const unreadByConv: Record<string, number> = {};
        (unreadData || []).forEach((r: any) => {
          unreadByConv[r.conversation_id] = (unreadByConv[r.conversation_id] || 0) + 1;
        });
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("conversation_id, content")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        const lastByConv: Record<string, string> = {};
        (lastMsgs || []).forEach((m: any) => {
          if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = (m.content || "").slice(0, 40);
        });
        setConversations(
          convData.map((c: any) => ({
            id: c.id,
            patient_id: c.patient_id,
            medecin_id: c.medecin_id,
            last_message_at: c.last_message_at,
            created_at: c.created_at,
            other_name: nameByMed[c.medecin_id] || "Médecin",
            other_role: "Médecin",
            last_message_preview: lastByConv[c.id] || null,
            unread_count: unreadByConv[c.id] || 0,
          }))
        );
      }
      setLoadingConversations(false);
    };
    load();
  }, [userId, patientRowId, role]);

  useEffect(() => {
    if (initialConvId) setActiveConversationId(initialConvId);
  }, [initialConvId]);

  useEffect(() => {
    if (!activeConversationId || !userId) return;
    setLoadingMessages(true);
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, read, created_at, file_url, file_name, file_type")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("conversation_id", activeConversationId)
        .neq("sender_id", userId);
      setLoadingMessages(false);
      scrollToBottom();
    };
    load();
  }, [activeConversationId, userId]);

  useEffect(() => {
    if (!activeConversationId) return;
    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, scrollToBottom]);

  useEffect(() => {
    if (!activeConversationId || !userId) return;
    const channel = supabase
      .channel(`typing:${activeConversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_indicators", filter: `conversation_id=eq.${activeConversationId}` },
        async (payload) => {
          const row = payload.new as { conversation_id: string; user_id: string; updated_at: string } | undefined;
          if (!row || row.user_id === userId) return;
          const t = new Date(row.updated_at).getTime();
          if (Date.now() - t < 5000) {
            const { data: u } = await supabase.from("utilisateurs").select("nom, prenom").eq("id", row.user_id).single();
            const name = u ? [u.prenom, u.nom].filter(Boolean).join(" ") : "Quelqu'un";
            setOtherTyping(role === "patient" ? `Dr. ${name}` : name);
            if (typingClearRef.current) clearTimeout(typingClearRef.current);
            typingClearRef.current = setTimeout(() => setOtherTyping(null), 3000);
          } else setOtherTyping(null);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, userId]);

  const upsertTyping = useCallback(() => {
    if (!activeConversationId || !userId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    supabase.from("typing_indicators").upsert(
      { conversation_id: activeConversationId, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" }
    );
    typingTimeoutRef.current = setTimeout(() => setOtherTyping(null), TYPING_DEBOUNCE_MS);
  }, [activeConversationId, userId]);

  const handleSend = async () => {
    const content = input.trim();
    if (!activeConversationId || !userId || (!content && !uploading)) return;
    setInput("");
    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: userId,
      content: content || null,
      read: false,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", activeConversationId);
    scrollToBottom();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId || !userId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "";
    const path = `${activeConversationId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file, { upsert: true });
    e.target.value = "";
    if (upErr) {
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      sender_id: userId,
      content: null,
      read: false,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_type: file.type,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", activeConversationId);
    setUploading(false);
    scrollToBottom();
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const filteredConversations = conversations.filter((c) =>
    c.other_name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPatientsToStart = patientsToStart.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const startConversationWithPatient = async (patientId: string, patientName: string) => {
    if (!userId) return;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("patient_id", patientId)
      .eq("medecin_id", userId)
      .maybeSingle();
    let convId = (existing as any)?.id;
    if (!convId) {
      const { data: inserted } = await supabase
        .from("conversations")
        .insert({ patient_id: patientId, medecin_id: userId })
        .select("id")
        .single();
      convId = (inserted as any)?.id;
    }
    if (convId) {
      setConversations((prev) => [
        {
          id: convId,
          patient_id: patientId,
          medecin_id: userId,
          last_message_at: null,
          created_at: new Date().toISOString(),
          other_name: patientName,
          other_role: "Patient",
          last_message_preview: null,
          unread_count: 0,
        },
        ...prev,
      ]);
      setPatientsToStart((prev) => prev.filter((p) => p.id !== patientId));
      setActiveConversationId(convId);
    }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { label: string; messages: Message[] }[] = [];
    let currentLabel = "";
    let currentGroup: Message[] = [];
    msgs.forEach((m) => {
      const d = new Date(m.created_at);
      const label = isToday(d) ? "Aujourd'hui" : isYesterday(d) ? "Hier" : format(d, "d MMMM yyyy", { locale: fr });
      if (label !== currentLabel) {
        if (currentGroup.length) groups.push({ label: currentLabel, messages: currentGroup });
        currentLabel = label;
        currentGroup = [m];
      } else currentGroup.push(m);
    });
    if (currentGroup.length) groups.push({ label: currentLabel, messages: currentGroup });
    return groups;
  };

  const isImage = (fileType: string | null | undefined) =>
    fileType?.startsWith("image/");

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Left: conversation list */}
        <div className="w-full sm:w-80 border-r border-border flex flex-col bg-muted/30">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {filteredConversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConversationId(c.id)}
                    className={`w-full text-left p-3 border-b border-border/60 transition-colors ${
                    activeConversationId === c.id ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                      {c.other_name.slice(0, 2).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{c.other_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                          {c.other_role}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.last_message_preview || "Aucun message"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {c.last_message_at ? format(new Date(c.last_message_at), "dd/MM HH:mm", { locale: fr }) : ""}
                      </p>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}

                {role === "doctor" && filteredPatientsToStart.length > 0 && (
                  <div className="border-t border-border pt-2 pb-2">
                    <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Commencer une conversation
                    </p>
                    {filteredPatientsToStart.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => startConversationWithPatient(p.id, p.name)}
                        className="w-full text-left p-3 border-b border-border/60 hover:bg-muted/50 transition-colors last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 font-semibold shrink-0">
                            {p.name.slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate block">{p.name}</span>
                            <span className="text-xs text-muted-foreground">Cliquer pour envoyer un message</span>
                          </div>
                          <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {filteredConversations.length === 0 &&
                  (role !== "doctor" || filteredPatientsToStart.length === 0) && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {role === "doctor"
                        ? "Aucun patient assigné"
                        : "Votre médecin vous contactera ici"}
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {/* Right: chat window */}
        <div className="flex-1 flex flex-col min-w-0 bg-card">
          {!activeConversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <MessageSquare className="w-14 h-14 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium text-foreground">Sélectionnez une conversation pour commencer</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 p-3 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                    {activeConv?.other_name?.slice(0, 2).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground truncate">{activeConv?.other_name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-safe" />
                      <span className="text-xs text-muted-foreground">En ligne</span>
                    </div>
                  </div>
                </div>
                {role === "doctor" && dossierLink && activeConv && (
                  <Link
                    to={`${dossierLink}?patient=${activeConv.patient_id}`}
                    className="text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    Voir le dossier →
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-12 rounded-2xl bg-muted animate-pulse ${i % 2 ? "ml-8" : "mr-8"}`} />
                    ))}
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((group) => (
                    <div key={group.label}>
                      <p className="text-xs text-muted-foreground text-center mb-2">{group.label}</p>
                      {group.messages.map((m) => {
                        const isOwn = m.sender_id === userId;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                                isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                              }`}
                            >
                              {m.content && <p className="text-sm break-words">{m.content}</p>}
                              {m.file_url && (
                                <div className="mt-1">
                                  {isImage(m.file_type) ? (
                                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block">
                                      <img src={m.file_url} alt={m.file_name || ""} className="rounded-lg max-h-40 object-cover" />
                                    </a>
                                  ) : (
                                    <a
                                      href={m.file_url}
                                      download={m.file_name || ""}
                                      className="text-xs underline flex items-center gap-1"
                                    >
                                      <FileText className="w-3 h-3" />
                                      {m.file_name || "Télécharger"}
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                                <span className="text-[10px] opacity-80">
                                  {format(new Date(m.created_at), "HH:mm", { locale: fr })}
                                </span>
                                {isOwn && (
                                  m.read ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-safe" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <AnimatePresence>
                  {otherTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <span>{otherTyping} est en train d&apos;écrire</span>
                      <span className="inline-flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder="Écrire un message..."
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    upsertTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() && !uploading}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
