import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Bot, User, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: "user" | "bot";
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    { role: "bot", content: "Hello! I'm your EduVault assistant. How can I help you with question banks or exam papers today?" }
  ]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // 1. Fetch relevant context from Firestore
      // We'll search for resources that match keywords in the user's message
      const keywords = userMessage.toLowerCase().split(" ").filter(w => w.length > 3);
      let context = "";
      
      if (keywords.length > 0) {
        const resourcesRef = collection(db, "academic_resources");
        const q = query(
          resourcesRef,
          where("status", "==", "approved"),
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        const relevantDocs = snapshot.docs
          .map(doc => doc.data())
          .filter(doc => 
            keywords.some(k => 
              doc.title?.toLowerCase().includes(k) || 
              doc.subject?.toLowerCase().includes(k) ||
              doc.department?.toLowerCase().includes(k)
            )
          );

        if (relevantDocs.length > 0) {
          context = "Relevant resources found in EduVault:\n" + 
            relevantDocs.map(d => `- ${d.category.toUpperCase()}: ${d.title} (${d.subject}, Dept: ${d.department}, Year: ${d.year})`).join("\n");
        }
      }

      // 2. Call Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const prompt = `You are an AI assistant for EduVault, an academic resource management system.
      Your goal is to help users find information about uploaded question banks (QB) and previous year papers (PYQ).
      
      Context from Database:
      ${context || "No specific matching documents found in the immediate search, but you can answer general academic questions or explain how to use the system."}
      
      User Question: ${userMessage}
      
      Instructions:
      - If the context contains relevant documents, mention them.
      - If the user asks for a specific paper, tell them they can find it in the "Exam Repository" or "Question Bank" sections by filtering for their department and year.
      - Be helpful, concise, and professional.
      - If you don't know something about the specific files, guide them on how to use the dashboard filters.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setMessages(prev => [...prev, { role: "bot", content: result.text || "I'm sorry, I couldn't process that request." }]);
    } catch (error) {
      console.error("ChatBot Error:", error);
      setMessages(prev => [...prev, { role: "bot", content: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] sm:w-[400px]"
          >
            <Card className="shadow-2xl border-none overflow-hidden bg-white">
              <CardHeader className="bg-primary p-4 flex flex-row items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">EduVault Assistant</CardTitle>
                    <p className="text-[10px] opacity-80">Online • AI Powered</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div 
                  ref={scrollRef}
                  className="h-[400px] overflow-y-auto p-4 space-y-4 bg-gray-50/50"
                >
                  {messages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                          msg.role === 'user' ? 'bg-blue-100' : 'bg-primary/10'
                        }`}>
                          {msg.role === 'user' ? <User className="w-4 h-4 text-blue-600" /> : <Bot className="w-4 h-4 text-primary" />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-primary text-white rounded-tr-none' 
                            : 'bg-white border text-gray-800 rounded-tl-none shadow-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 items-center bg-white border p-3 rounded-2xl rounded-tl-none shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white border-t">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                  >
                    <Input 
                      placeholder="Ask about papers, subjects..." 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={isLoading}
                      className="bg-gray-50 border-none focus-visible:ring-primary"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={isLoading || !input.trim()}
                      className="shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors ${
          isOpen ? 'bg-white text-primary border-2 border-primary' : 'bg-primary text-white'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
