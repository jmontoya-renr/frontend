export interface MetaData {
  limit?: number
  returned?: number
  next_cursor?: string
  prev_cursor?: string
  sort_by?: string
  sort_order?: string
  filters?: Record<string, Array<string>>
  request_id?: string
  generated_at?: string
  extra?: Record<string, unknown>
}

export interface PaginationData<T> {
  content: Array<T>
  meta: MetaData
}
