import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document as LangchainDocument } from 'langchain/document';

export interface ContextResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface ProcessedDocResult {
  chunks: number;
  embeddings: number;
}

export class RAGPipeline {
  private embeddingModel: OpenAIEmbeddings;
  private vectorStore: MemoryVectorStore | null = null;
  private tenantStores = new Map<string, MemoryVectorStore>();

  constructor(config: { openaiApiKey: string }) {
    this.embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: 'text-embedding-3-small',
    });
  }

  async processDocument(doc: {
    id: string;
    content: string;
    type: string;
  }): Promise<ProcessedDocResult> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const langchainDocs = [new LangchainDocument({ pageContent: doc.content, metadata: { docId: doc.id, type: doc.type } })];
    const splitDocs = await splitter.splitDocuments(langchainDocs);

    // In production, use a persistent vector store (Pinecone, Supabase pgvector, etc.)
    // For now, use in-memory store per tenant
    const store = new MemoryVectorStore(this.embeddingModel);
    await store.addDocuments(splitDocs);

    this.tenantStores.set(doc.id, store);
    this.vectorStore = store;

    return {
      chunks: splitDocs.length,
      embeddings: splitDocs.length,
    };
  }

  async search(
    query: string,
    tenantId: string,
    agentId?: string,
    limit = 5,
  ): Promise<ContextResult[]> {
    const store = this.vectorStore ?? this.tenantStores.get(tenantId);

    if (!store) {
      return [];
    }

    const queryEmbedding = await this.embeddingModel.embedQuery(query);
    const results = await store.similaritySearchVectorWithScore(queryEmbedding, limit);

    return results.map(([doc, score]: [LangchainDocument, number]) => ({
      id: doc.metadata.docId as string,
      content: doc.pageContent,
      score,
      metadata: doc.metadata as Record<string, unknown>,
    }));
  }

  async buildContext(query: string, tenantId: string, agentId?: string): Promise<string> {
    const results = await this.search(query, tenantId, agentId);

    if (results.length === 0) {
      return '';
    }

    return results
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n');
  }

  async deleteDocument(docId: string): Promise<void> {
    this.tenantStores.delete(docId);
    if (this.vectorStore) {
      this.vectorStore = null;
    }
  }
}
