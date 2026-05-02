/**
 * airports.ts — Base estática de aeroportos (≈ 450 entradas).
 * Elimina dependência da Amadeus API para autocomplete.
 * Cobre: todos os aeroportos comerciais do Brasil + principais hubs mundiais.
 */
import type { Airport } from './amadeus'

export const AIRPORTS: Airport[] = [
    // ── Brasil ────────────────────────────────────────────────────────────────
    { iataCode: 'GRU', name: 'Guarulhos Intl. (Cumbica)', cityName: 'São Paulo', countryCode: 'BR', label: '' },
    { iataCode: 'CGH', name: 'Congonhas', cityName: 'São Paulo', countryCode: 'BR', label: '' },
    { iataCode: 'VCP', name: 'Viracopos Intl.', cityName: 'Campinas', countryCode: 'BR', label: '' },
    { iataCode: 'GIG', name: 'Galeão Intl. (Tom Jobim)', cityName: 'Rio de Janeiro', countryCode: 'BR', label: '' },
    { iataCode: 'SDU', name: 'Santos Dumont', cityName: 'Rio de Janeiro', countryCode: 'BR', label: '' },
    { iataCode: 'BSB', name: 'Pres. Juscelino Kubitschek Intl.', cityName: 'Brasília', countryCode: 'BR', label: '' },
    { iataCode: 'SSA', name: 'Luís Eduardo Magalhães Intl.', cityName: 'Salvador', countryCode: 'BR', label: '' },
    { iataCode: 'FOR', name: 'Pinto Martins Intl.', cityName: 'Fortaleza', countryCode: 'BR', label: '' },
    { iataCode: 'REC', name: 'Guararapes–Gilberto Freyre Intl.', cityName: 'Recife', countryCode: 'BR', label: '' },
    { iataCode: 'POA', name: 'Salgado Filho Intl.', cityName: 'Porto Alegre', countryCode: 'BR', label: '' },
    { iataCode: 'CWB', name: 'Afonso Pena Intl.', cityName: 'Curitiba', countryCode: 'BR', label: '' },
    { iataCode: 'BEL', name: 'Val de Cans Intl.', cityName: 'Belém', countryCode: 'BR', label: '' },
    { iataCode: 'MAO', name: 'Eduardo Gomes Intl.', cityName: 'Manaus', countryCode: 'BR', label: '' },
    { iataCode: 'CNF', name: 'Tancredo Neves Intl.', cityName: 'Belo Horizonte', countryCode: 'BR', label: '' },
    { iataCode: 'PLU', name: 'Pampulha – Carlos Drummond', cityName: 'Belo Horizonte', countryCode: 'BR', label: '' },
    { iataCode: 'FLN', name: 'Hercílio Luz Intl.', cityName: 'Florianópolis', countryCode: 'BR', label: '' },
    { iataCode: 'GYN', name: 'Santa Genoveva', cityName: 'Goiânia', countryCode: 'BR', label: '' },
    { iataCode: 'NAT', name: 'Gov. Aluízio Alves Intl.', cityName: 'Natal', countryCode: 'BR', label: '' },
    { iataCode: 'MCZ', name: 'Zumbi dos Palmares Intl.', cityName: 'Maceió', countryCode: 'BR', label: '' },
    { iataCode: 'JPA', name: 'Pres. Castro Pinto Intl.', cityName: 'João Pessoa', countryCode: 'BR', label: '' },
    { iataCode: 'AJU', name: 'Santa Maria Intl.', cityName: 'Aracaju', countryCode: 'BR', label: '' },
    { iataCode: 'THE', name: 'Senador Petrônio Portella', cityName: 'Teresina', countryCode: 'BR', label: '' },
    { iataCode: 'SLZ', name: 'Marechal Cunha Machado Intl.', cityName: 'São Luís', countryCode: 'BR', label: '' },
    { iataCode: 'PVH', name: 'Gov. Jorge Teixeira Intl.', cityName: 'Porto Velho', countryCode: 'BR', label: '' },
    { iataCode: 'RBR', name: 'Plácido de Castro Intl.', cityName: 'Rio Branco', countryCode: 'BR', label: '' },
    { iataCode: 'BVB', name: 'Atlas Brasil Cantanhede Intl.', cityName: 'Boa Vista', countryCode: 'BR', label: '' },
    { iataCode: 'MCP', name: 'Alberto Alcolumbre Intl.', cityName: 'Macapá', countryCode: 'BR', label: '' },
    { iataCode: 'PMW', name: 'Brigadeiro Lysias Rodrigues', cityName: 'Palmas', countryCode: 'BR', label: '' },
    { iataCode: 'CGR', name: 'Campo Grande Intl.', cityName: 'Campo Grande', countryCode: 'BR', label: '' },
    { iataCode: 'CGB', name: 'Marechal Rondon Intl.', cityName: 'Cuiabá', countryCode: 'BR', label: '' },
    { iataCode: 'VIX', name: 'Eurico de Aguiar Salles', cityName: 'Vitória', countryCode: 'BR', label: '' },
    { iataCode: 'BPS', name: 'Porto Seguro', cityName: 'Porto Seguro', countryCode: 'BR', label: '' },
    { iataCode: 'IOS', name: 'Jorge Amado', cityName: 'Ilhéus', countryCode: 'BR', label: '' },
    { iataCode: 'IGU', name: 'Cataratas Intl.', cityName: 'Foz do Iguaçu', countryCode: 'BR', label: '' },
    { iataCode: 'UDI', name: 'Ten. Cel. Av. César Bombonato', cityName: 'Uberlândia', countryCode: 'BR', label: '' },
    { iataCode: 'LDB', name: 'Governador José Richa', cityName: 'Londrina', countryCode: 'BR', label: '' },
    { iataCode: 'MGF', name: 'Silvio Name Junior', cityName: 'Maringá', countryCode: 'BR', label: '' },
    { iataCode: 'JOI', name: 'Lauro Carneiro de Loyola', cityName: 'Joinville', countryCode: 'BR', label: '' },
    { iataCode: 'NVT', name: 'Ministro Victor Konder Intl.', cityName: 'Navegantes', countryCode: 'BR', label: '' },
    { iataCode: 'XAP', name: 'Chapecó', cityName: 'Chapecó', countryCode: 'BR', label: '' },
    { iataCode: 'CXJ', name: 'Hugo Cantergiani', cityName: 'Caxias do Sul', countryCode: 'BR', label: '' },
    { iataCode: 'PNZ', name: 'Intl. de Petrolina', cityName: 'Petrolina', countryCode: 'BR', label: '' },
    { iataCode: 'IMP', name: 'Prefeito Renato Moreira', cityName: 'Imperatriz', countryCode: 'BR', label: '' },
    { iataCode: 'JDO', name: 'Orlando Bezerra de Menezes', cityName: 'Juazeiro do Norte', countryCode: 'BR', label: '' },
    { iataCode: 'CPV', name: 'Presidente João Suassuna', cityName: 'Campina Grande', countryCode: 'BR', label: '' },
    { iataCode: 'STM', name: 'Maestro Wilson Fonseca', cityName: 'Santarém', countryCode: 'BR', label: '' },
    { iataCode: 'CKS', name: 'Carajás', cityName: 'Parauapebas', countryCode: 'BR', label: '' },
    { iataCode: 'MAB', name: 'João Correa da Rocha', cityName: 'Marabá', countryCode: 'BR', label: '' },
    { iataCode: 'SJP', name: 'Prof. Eribelto Manoel Reino', cityName: 'São José do Rio Preto', countryCode: 'BR', label: '' },
    { iataCode: 'RAO', name: 'Leite Lopes', cityName: 'Ribeirão Preto', countryCode: 'BR', label: '' },
    { iataCode: 'ARU', name: 'Dario Guarita', cityName: 'Araçatuba', countryCode: 'BR', label: '' },
    { iataCode: 'PPB', name: 'Adalberto Mendes da Silva', cityName: 'Presidente Prudente', countryCode: 'BR', label: '' },
    { iataCode: 'BAU', name: 'Bauru-Arealva', cityName: 'Bauru', countryCode: 'BR', label: '' },
    { iataCode: 'MOC', name: 'Mário de Almeida Franco', cityName: 'Montes Claros', countryCode: 'BR', label: '' },
    { iataCode: 'PFB', name: 'Lauro Kortz', cityName: 'Passo Fundo', countryCode: 'BR', label: '' },
    { iataCode: 'URG', name: 'Ruben Berta', cityName: 'Uruguaiana', countryCode: 'BR', label: '' },
    { iataCode: 'BGX', name: 'Comandante Gustavo Kraemer', cityName: 'Bagé', countryCode: 'BR', label: '' },
    { iataCode: 'PET', name: 'João Simões Lopes Neto Intl.', cityName: 'Pelotas', countryCode: 'BR', label: '' },
    { iataCode: 'JPR', name: 'Ji-Paraná', cityName: 'Ji-Paraná', countryCode: 'BR', label: '' },
    { iataCode: 'BVH', name: 'Brigadeiro Eduardo Gomes', cityName: 'Vilhena', countryCode: 'BR', label: '' },
    { iataCode: 'OPS', name: 'Sinop', cityName: 'Sinop', countryCode: 'BR', label: '' },
    { iataCode: 'ATM', name: 'Altamira', cityName: 'Altamira', countryCode: 'BR', label: '' },
    { iataCode: 'TFF', name: 'Tefé', cityName: 'Tefé', countryCode: 'BR', label: '' },
    { iataCode: 'TBT', name: 'Tabatinga Intl.', cityName: 'Tabatinga', countryCode: 'BR', label: '' },
    { iataCode: 'CZS', name: 'Cruzeiro do Sul Intl.', cityName: 'Cruzeiro do Sul', countryCode: 'BR', label: '' },
    { iataCode: 'CLV', name: 'Caldas Novas', cityName: 'Caldas Novas', countryCode: 'BR', label: '' },
    { iataCode: 'PMG', name: 'Ponta Porã Intl.', cityName: 'Ponta Porã', countryCode: 'BR', label: '' },
    { iataCode: 'MVF', name: 'Dix-Sept Rosado Intl.', cityName: 'Mossoró', countryCode: 'BR', label: '' },
    { iataCode: 'MII', name: 'Frank Miloye Milenkowichi', cityName: 'Marília', countryCode: 'BR', label: '' },
    { iataCode: 'CAC', name: 'Cascavel', cityName: 'Cascavel', countryCode: 'BR', label: '' },

    // ── Estados Unidos ────────────────────────────────────────────────────────
    { iataCode: 'JFK', name: 'John F. Kennedy Intl.', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'EWR', name: 'Newark Liberty Intl.', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'LGA', name: 'LaGuardia', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'MIA', name: 'Miami Intl.', cityName: 'Miami', countryCode: 'US', label: '' },
    { iataCode: 'FLL', name: 'Fort Lauderdale Intl.', cityName: 'Fort Lauderdale', countryCode: 'US', label: '' },
    { iataCode: 'MCO', name: 'Orlando Intl.', cityName: 'Orlando', countryCode: 'US', label: '' },
    { iataCode: 'TPA', name: 'Tampa Intl.', cityName: 'Tampa', countryCode: 'US', label: '' },
    { iataCode: 'LAX', name: 'Los Angeles Intl.', cityName: 'Los Angeles', countryCode: 'US', label: '' },
    { iataCode: 'SFO', name: 'San Francisco Intl.', cityName: 'São Francisco', countryCode: 'US', label: '' },
    { iataCode: 'SJC', name: 'Norman Y. Mineta San José Intl.', cityName: 'San José', countryCode: 'US', label: '' },
    { iataCode: 'OAK', name: 'Oakland Intl.', cityName: 'Oakland', countryCode: 'US', label: '' },
    { iataCode: 'ORD', name: "O'Hare Intl.", cityName: 'Chicago', countryCode: 'US', label: '' },
    { iataCode: 'MDW', name: 'Midway Intl.', cityName: 'Chicago', countryCode: 'US', label: '' },
    { iataCode: 'ATL', name: 'Hartsfield-Jackson Atlanta Intl.', cityName: 'Atlanta', countryCode: 'US', label: '' },
    { iataCode: 'DFW', name: 'Dallas/Fort Worth Intl.', cityName: 'Dallas', countryCode: 'US', label: '' },
    { iataCode: 'IAH', name: 'George Bush Intercontinental', cityName: 'Houston', countryCode: 'US', label: '' },
    { iataCode: 'HOU', name: 'William P. Hobby', cityName: 'Houston', countryCode: 'US', label: '' },
    { iataCode: 'DEN', name: 'Denver Intl.', cityName: 'Denver', countryCode: 'US', label: '' },
    { iataCode: 'PHX', name: 'Phoenix Sky Harbor Intl.', cityName: 'Phoenix', countryCode: 'US', label: '' },
    { iataCode: 'SEA', name: 'Seattle-Tacoma Intl.', cityName: 'Seattle', countryCode: 'US', label: '' },
    { iataCode: 'LAS', name: 'Harry Reid Intl.', cityName: 'Las Vegas', countryCode: 'US', label: '' },
    { iataCode: 'MSP', name: 'Minneapolis-Saint Paul Intl.', cityName: 'Minneapolis', countryCode: 'US', label: '' },
    { iataCode: 'DTW', name: 'Detroit Metropolitan Wayne County', cityName: 'Detroit', countryCode: 'US', label: '' },
    { iataCode: 'CLT', name: 'Charlotte Douglas Intl.', cityName: 'Charlotte', countryCode: 'US', label: '' },
    { iataCode: 'PHL', name: 'Philadelphia Intl.', cityName: 'Philadelphia', countryCode: 'US', label: '' },
    { iataCode: 'DCA', name: 'Ronald Reagan Washington National', cityName: 'Washington', countryCode: 'US', label: '' },
    { iataCode: 'IAD', name: 'Dulles Intl.', cityName: 'Washington', countryCode: 'US', label: '' },
    { iataCode: 'BWI', name: 'Baltimore/Washington Intl.', cityName: 'Baltimore', countryCode: 'US', label: '' },
    { iataCode: 'BOS', name: 'Logan Intl.', cityName: 'Boston', countryCode: 'US', label: '' },
    { iataCode: 'MSY', name: 'Louis Armstrong New Orleans Intl.', cityName: 'Nova Orleans', countryCode: 'US', label: '' },
    { iataCode: 'SAN', name: 'San Diego Intl.', cityName: 'San Diego', countryCode: 'US', label: '' },
    { iataCode: 'PDX', name: 'Portland Intl.', cityName: 'Portland', countryCode: 'US', label: '' },
    { iataCode: 'SLC', name: 'Salt Lake City Intl.', cityName: 'Salt Lake City', countryCode: 'US', label: '' },
    { iataCode: 'BNA', name: 'Nashville Intl.', cityName: 'Nashville', countryCode: 'US', label: '' },
    { iataCode: 'AUS', name: 'Austin-Bergstrom Intl.', cityName: 'Austin', countryCode: 'US', label: '' },
    { iataCode: 'SAT', name: 'San Antonio Intl.', cityName: 'San Antonio', countryCode: 'US', label: '' },
    { iataCode: 'RDU', name: 'Raleigh-Durham Intl.', cityName: 'Raleigh', countryCode: 'US', label: '' },
    { iataCode: 'MCI', name: 'Kansas City Intl.', cityName: 'Kansas City', countryCode: 'US', label: '' },
    { iataCode: 'STL', name: 'Lambert-St. Louis Intl.', cityName: 'St. Louis', countryCode: 'US', label: '' },
    { iataCode: 'CLE', name: 'Cleveland Hopkins Intl.', cityName: 'Cleveland', countryCode: 'US', label: '' },
    { iataCode: 'PIT', name: 'Pittsburgh Intl.', cityName: 'Pittsburgh', countryCode: 'US', label: '' },
    { iataCode: 'CMH', name: 'John Glenn Columbus Intl.', cityName: 'Columbus', countryCode: 'US', label: '' },
    { iataCode: 'IND', name: 'Indianapolis Intl.', cityName: 'Indianapolis', countryCode: 'US', label: '' },
    { iataCode: 'MKE', name: 'General Mitchell Intl.', cityName: 'Milwaukee', countryCode: 'US', label: '' },
    { iataCode: 'JAX', name: 'Jacksonville Intl.', cityName: 'Jacksonville', countryCode: 'US', label: '' },
    { iataCode: 'RSW', name: 'Southwest Florida Intl.', cityName: 'Fort Myers', countryCode: 'US', label: '' },
    { iataCode: 'PBI', name: 'Palm Beach Intl.', cityName: 'West Palm Beach', countryCode: 'US', label: '' },
    { iataCode: 'BUF', name: 'Buffalo Niagara Intl.', cityName: 'Buffalo', countryCode: 'US', label: '' },
    { iataCode: 'HNL', name: 'Daniel K. Inouye Intl.', cityName: 'Honolulu', countryCode: 'US', label: '' },
    { iataCode: 'ANC', name: 'Ted Stevens Anchorage Intl.', cityName: 'Anchorage', countryCode: 'US', label: '' },

    // ── Canadá ────────────────────────────────────────────────────────────────
    { iataCode: 'YYZ', name: 'Lester B. Pearson Intl.', cityName: 'Toronto', countryCode: 'CA', label: '' },
    { iataCode: 'YUL', name: 'Montréal-Trudeau Intl.', cityName: 'Montreal', countryCode: 'CA', label: '' },
    { iataCode: 'YVR', name: 'Vancouver Intl.', cityName: 'Vancouver', countryCode: 'CA', label: '' },
    { iataCode: 'YYC', name: 'Calgary Intl.', cityName: 'Calgary', countryCode: 'CA', label: '' },
    { iataCode: 'YOW', name: 'Ottawa Macdonald-Cartier Intl.', cityName: 'Ottawa', countryCode: 'CA', label: '' },
    { iataCode: 'YEG', name: 'Edmonton Intl.', cityName: 'Edmonton', countryCode: 'CA', label: '' },
    { iataCode: 'YHZ', name: 'Halifax Stanfield Intl.', cityName: 'Halifax', countryCode: 'CA', label: '' },

    // ── México ────────────────────────────────────────────────────────────────
    { iataCode: 'MEX', name: 'Benito Juárez Intl.', cityName: 'Cidade do México', countryCode: 'MX', label: '' },
    { iataCode: 'CUN', name: 'Cancún Intl.', cityName: 'Cancún', countryCode: 'MX', label: '' },
    { iataCode: 'GDL', name: 'Don Miguel Hidalgo y Costilla Intl.', cityName: 'Guadalajara', countryCode: 'MX', label: '' },
    { iataCode: 'MTY', name: 'Gen. Mariano Escobedo Intl.', cityName: 'Monterrey', countryCode: 'MX', label: '' },
    { iataCode: 'SJD', name: 'Los Cabos Intl.', cityName: 'Los Cabos', countryCode: 'MX', label: '' },
    { iataCode: 'PVR', name: 'Licenciado Gustavo Díaz Ordaz Intl.', cityName: 'Puerto Vallarta', countryCode: 'MX', label: '' },
    { iataCode: 'MZT', name: 'Gen. Rafael Buelna Intl.', cityName: 'Mazatlán', countryCode: 'MX', label: '' },
    { iataCode: 'ZIH', name: 'Ixtapa-Zihuatanejo Intl.', cityName: 'Zihuatanejo', countryCode: 'MX', label: '' },
    { iataCode: 'OAX', name: 'Xoxocotlán Intl.', cityName: 'Oaxaca', countryCode: 'MX', label: '' },
    { iataCode: 'MID', name: 'Manuel Crescencio Rejon Intl.', cityName: 'Mérida', countryCode: 'MX', label: '' },

    // ── América do Sul ────────────────────────────────────────────────────────
    { iataCode: 'EZE', name: 'Ministro Pistarini Intl. (Ezeiza)', cityName: 'Buenos Aires', countryCode: 'AR', label: '' },
    { iataCode: 'AEP', name: 'Jorge Newbery (Aeroparque)', cityName: 'Buenos Aires', countryCode: 'AR', label: '' },
    { iataCode: 'COR', name: 'Ingeniero Aeronáutico Ambrosio Taravella', cityName: 'Córdoba', countryCode: 'AR', label: '' },
    { iataCode: 'MDZ', name: 'Gov. Francisco Gabrielli Intl.', cityName: 'Mendoza', countryCode: 'AR', label: '' },
    { iataCode: 'IGR', name: 'Cataratas del Iguazú Intl.', cityName: 'Puerto Iguazú', countryCode: 'AR', label: '' },
    { iataCode: 'BRC', name: 'San Carlos de Bariloche Intl.', cityName: 'Bariloche', countryCode: 'AR', label: '' },
    { iataCode: 'ROS', name: 'Islas Malvinas Intl.', cityName: 'Rosario', countryCode: 'AR', label: '' },
    { iataCode: 'SCL', name: 'Arturo Merino Benítez Intl.', cityName: 'Santiago', countryCode: 'CL', label: '' },
    { iataCode: 'IQQ', name: 'Diego Aracena Intl.', cityName: 'Iquique', countryCode: 'CL', label: '' },
    { iataCode: 'ANF', name: 'Cerro Moreno Intl.', cityName: 'Antofagasta', countryCode: 'CL', label: '' },
    { iataCode: 'PMC', name: 'El Tepual Intl.', cityName: 'Puerto Montt', countryCode: 'CL', label: '' },
    { iataCode: 'PUQ', name: 'Carlos Ibáñez del Campo Intl.', cityName: 'Punta Arenas', countryCode: 'CL', label: '' },
    { iataCode: 'LSC', name: 'La Florida', cityName: 'La Serena', countryCode: 'CL', label: '' },
    { iataCode: 'BOG', name: 'El Dorado Intl.', cityName: 'Bogotá', countryCode: 'CO', label: '' },
    { iataCode: 'MDE', name: 'José María Córdova Intl.', cityName: 'Medellín', countryCode: 'CO', label: '' },
    { iataCode: 'CLO', name: 'Alfonso Bonilla Aragón Intl.', cityName: 'Cali', countryCode: 'CO', label: '' },
    { iataCode: 'CTG', name: 'Rafael Núñez Intl.', cityName: 'Cartagena', countryCode: 'CO', label: '' },
    { iataCode: 'BAQ', name: 'Ernesto Cortissoz Intl.', cityName: 'Barranquilla', countryCode: 'CO', label: '' },
    { iataCode: 'LIM', name: 'Jorge Chávez Intl.', cityName: 'Lima', countryCode: 'PE', label: '' },
    { iataCode: 'CUZ', name: 'Alejandro Velasco Astete Intl.', cityName: 'Cusco', countryCode: 'PE', label: '' },
    { iataCode: 'AQP', name: 'Rodríguez Ballón Intl.', cityName: 'Arequipa', countryCode: 'PE', label: '' },
    { iataCode: 'IQT', name: 'Coronel FAP Francisco Secada Vignetta', cityName: 'Iquitos', countryCode: 'PE', label: '' },
    { iataCode: 'UIO', name: 'Mariscal Sucre Intl.', cityName: 'Quito', countryCode: 'EC', label: '' },
    { iataCode: 'GYE', name: 'José Joaquín de Olmedo Intl.', cityName: 'Guayaquil', countryCode: 'EC', label: '' },
    { iataCode: 'CCS', name: 'Simón Bolívar Intl.', cityName: 'Caracas', countryCode: 'VE', label: '' },
    { iataCode: 'MVD', name: 'Carrasco Intl.', cityName: 'Montevidéu', countryCode: 'UY', label: '' },
    { iataCode: 'ASU', name: 'Silvio Pettirossi Intl.', cityName: 'Assunção', countryCode: 'PY', label: '' },
    { iataCode: 'VVI', name: 'Viru Viru Intl.', cityName: 'Santa Cruz', countryCode: 'BO', label: '' },
    { iataCode: 'LPB', name: 'El Alto Intl.', cityName: 'La Paz', countryCode: 'BO', label: '' },
    { iataCode: 'GEO', name: 'Cheddi Jagan Intl.', cityName: 'Georgetown', countryCode: 'GY', label: '' },
    { iataCode: 'PBM', name: 'Johan Adolf Pengel Intl.', cityName: 'Paramaribo', countryCode: 'SR', label: '' },

    // ── Europa — Portugal ─────────────────────────────────────────────────────
    { iataCode: 'LIS', name: 'Humberto Delgado Intl.', cityName: 'Lisboa', countryCode: 'PT', label: '' },
    { iataCode: 'OPO', name: 'Francisco Sá Carneiro Intl.', cityName: 'Porto', countryCode: 'PT', label: '' },
    { iataCode: 'FAO', name: 'Faro', cityName: 'Faro', countryCode: 'PT', label: '' },
    { iataCode: 'FNC', name: 'Cristiano Ronaldo Intl.', cityName: 'Funchal', countryCode: 'PT', label: '' },
    { iataCode: 'PDL', name: 'João Paulo II', cityName: 'Ponta Delgada', countryCode: 'PT', label: '' },
    { iataCode: 'TER', name: 'Lajes Field', cityName: 'Angra do Heroísmo', countryCode: 'PT', label: '' },

    // ── Europa — Espanha ──────────────────────────────────────────────────────
    { iataCode: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', cityName: 'Madrid', countryCode: 'ES', label: '' },
    { iataCode: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat', cityName: 'Barcelona', countryCode: 'ES', label: '' },
    { iataCode: 'AGP', name: 'Málaga-Costa del Sol', cityName: 'Málaga', countryCode: 'ES', label: '' },
    { iataCode: 'PMI', name: 'Palma de Mallorca', cityName: 'Palma de Mallorca', countryCode: 'ES', label: '' },
    { iataCode: 'ALC', name: 'Alicante-Elche Miguel Hernández', cityName: 'Alicante', countryCode: 'ES', label: '' },
    { iataCode: 'VLC', name: 'Valência', cityName: 'Valência', countryCode: 'ES', label: '' },
    { iataCode: 'SVQ', name: 'Sevilha', cityName: 'Sevilha', countryCode: 'ES', label: '' },
    { iataCode: 'BIO', name: 'Bilbao', cityName: 'Bilbao', countryCode: 'ES', label: '' },
    { iataCode: 'LPA', name: 'Gran Canária Intl.', cityName: 'Las Palmas', countryCode: 'ES', label: '' },
    { iataCode: 'TFS', name: 'Tenerife Sur', cityName: 'Tenerife', countryCode: 'ES', label: '' },
    { iataCode: 'TFN', name: 'Tenerife Norte', cityName: 'Tenerife', countryCode: 'ES', label: '' },

    // ── Europa — França ───────────────────────────────────────────────────────
    { iataCode: 'CDG', name: 'Charles de Gaulle Intl.', cityName: 'Paris', countryCode: 'FR', label: '' },
    { iataCode: 'ORY', name: 'Orly', cityName: 'Paris', countryCode: 'FR', label: '' },
    { iataCode: 'NCE', name: 'Côte d\'Azur Intl.', cityName: 'Nice', countryCode: 'FR', label: '' },
    { iataCode: 'LYS', name: 'Lyon-Saint Exupéry', cityName: 'Lyon', countryCode: 'FR', label: '' },
    { iataCode: 'MRS', name: 'Marseille Provence', cityName: 'Marselha', countryCode: 'FR', label: '' },
    { iataCode: 'TLS', name: 'Toulouse-Blagnac', cityName: 'Toulouse', countryCode: 'FR', label: '' },
    { iataCode: 'BOD', name: 'Bordeaux-Mérignac', cityName: 'Bordeaux', countryCode: 'FR', label: '' },
    { iataCode: 'NTE', name: 'Nantes Atlantique', cityName: 'Nantes', countryCode: 'FR', label: '' },
    { iataCode: 'MPL', name: 'Montpellier-Méditerranée', cityName: 'Montpellier', countryCode: 'FR', label: '' },
    { iataCode: 'FDF', name: 'Martinica Aimé Césaire', cityName: 'Fort-de-France', countryCode: 'FR', label: '' },
    { iataCode: 'PTP', name: 'Pointe-à-Pitre Intl.', cityName: 'Pointe-à-Pitre', countryCode: 'FR', label: '' },
    { iataCode: 'GND', name: 'Point Salines Intl.', cityName: 'Granada', countryCode: 'GD', label: '' },

    // ── Europa — Reino Unido ──────────────────────────────────────────────────
    { iataCode: 'LHR', name: 'London Heathrow', cityName: 'Londres', countryCode: 'GB', label: '' },
    { iataCode: 'LGW', name: 'London Gatwick', cityName: 'Londres', countryCode: 'GB', label: '' },
    { iataCode: 'STN', name: 'London Stansted', cityName: 'Londres', countryCode: 'GB', label: '' },
    { iataCode: 'LCY', name: 'London City', cityName: 'Londres', countryCode: 'GB', label: '' },
    { iataCode: 'MAN', name: 'Manchester', cityName: 'Manchester', countryCode: 'GB', label: '' },
    { iataCode: 'EDI', name: 'Edinburgh', cityName: 'Edimburgo', countryCode: 'GB', label: '' },
    { iataCode: 'BHX', name: 'Birmingham', cityName: 'Birmingham', countryCode: 'GB', label: '' },
    { iataCode: 'GLA', name: 'Glasgow', cityName: 'Glasgow', countryCode: 'GB', label: '' },
    { iataCode: 'BRS', name: 'Bristol', cityName: 'Bristol', countryCode: 'GB', label: '' },

    // ── Europa — Alemanha ─────────────────────────────────────────────────────
    { iataCode: 'FRA', name: 'Frankfurt am Main', cityName: 'Frankfurt', countryCode: 'DE', label: '' },
    { iataCode: 'MUC', name: 'Franz Josef Strauss Intl.', cityName: 'Munique', countryCode: 'DE', label: '' },
    { iataCode: 'DUS', name: 'Düsseldorf Intl.', cityName: 'Düsseldorf', countryCode: 'DE', label: '' },
    { iataCode: 'HAM', name: 'Hamburg', cityName: 'Hamburgo', countryCode: 'DE', label: '' },
    { iataCode: 'BER', name: 'Berlin Brandenburg', cityName: 'Berlim', countryCode: 'DE', label: '' },
    { iataCode: 'CGN', name: 'Colónia/Bonn', cityName: 'Colônia', countryCode: 'DE', label: '' },
    { iataCode: 'STR', name: 'Stuttgart', cityName: 'Stuttgart', countryCode: 'DE', label: '' },

    // ── Europa — Itália ───────────────────────────────────────────────────────
    { iataCode: 'FCO', name: 'Leonardo da Vinci–Fiumicino', cityName: 'Roma', countryCode: 'IT', label: '' },
    { iataCode: 'CIA', name: 'Roma Ciampino', cityName: 'Roma', countryCode: 'IT', label: '' },
    { iataCode: 'MXP', name: 'Milano Malpensa', cityName: 'Milão', countryCode: 'IT', label: '' },
    { iataCode: 'LIN', name: 'Milano Linate', cityName: 'Milão', countryCode: 'IT', label: '' },
    { iataCode: 'BGY', name: 'Milano Bergamo Orio al Serio', cityName: 'Bergamo', countryCode: 'IT', label: '' },
    { iataCode: 'VCE', name: 'Marco Polo', cityName: 'Veneza', countryCode: 'IT', label: '' },
    { iataCode: 'NAP', name: 'Napoli Capodichino', cityName: 'Nápoles', countryCode: 'IT', label: '' },
    { iataCode: 'BLQ', name: 'Guglielmo Marconi', cityName: 'Bolonha', countryCode: 'IT', label: '' },
    { iataCode: 'FLR', name: 'Amerigo Vespucci (Peretola)', cityName: 'Florença', countryCode: 'IT', label: '' },
    { iataCode: 'CTA', name: 'Fontanarossa', cityName: 'Catânia', countryCode: 'IT', label: '' },
    { iataCode: 'PMO', name: 'Falcone Borsellino', cityName: 'Palermo', countryCode: 'IT', label: '' },
    { iataCode: 'BRI', name: 'Karol Wojtyla', cityName: 'Bari', countryCode: 'IT', label: '' },

    // ── Europa — Países Baixos / Bélgica / Suíça / Áustria ───────────────────
    { iataCode: 'AMS', name: 'Amsterdam Schiphol', cityName: 'Amsterdam', countryCode: 'NL', label: '' },
    { iataCode: 'EIN', name: 'Eindhoven', cityName: 'Eindhoven', countryCode: 'NL', label: '' },
    { iataCode: 'BRU', name: 'Brussels', cityName: 'Bruxelas', countryCode: 'BE', label: '' },
    { iataCode: 'CRL', name: 'Brussels South Charleroi', cityName: 'Charleroi', countryCode: 'BE', label: '' },
    { iataCode: 'ZRH', name: 'Zürich', cityName: 'Zurique', countryCode: 'CH', label: '' },
    { iataCode: 'GVA', name: 'Geneva', cityName: 'Genebra', countryCode: 'CH', label: '' },
    { iataCode: 'BSL', name: 'EuroAirport Basel–Mulhouse–Freiburg', cityName: 'Basel', countryCode: 'CH', label: '' },
    { iataCode: 'VIE', name: 'Vienna Intl.', cityName: 'Viena', countryCode: 'AT', label: '' },
    { iataCode: 'INN', name: 'Innsbruck', cityName: 'Innsbruck', countryCode: 'AT', label: '' },
    { iataCode: 'SZG', name: 'Salzburg W.A. Mozart', cityName: 'Salzburgo', countryCode: 'AT', label: '' },

    // ── Europa — Escandinávia / Nordics ───────────────────────────────────────
    { iataCode: 'CPH', name: 'Copenhagen', cityName: 'Copenhague', countryCode: 'DK', label: '' },
    { iataCode: 'OSL', name: 'Oslo Gardermoen', cityName: 'Oslo', countryCode: 'NO', label: '' },
    { iataCode: 'BGO', name: 'Bergen Flesland', cityName: 'Bergen', countryCode: 'NO', label: '' },
    { iataCode: 'ARN', name: 'Stockholm Arlanda', cityName: 'Estocolmo', countryCode: 'SE', label: '' },
    { iataCode: 'GOT', name: 'Gothenburg Landvetter', cityName: 'Gotemburgo', countryCode: 'SE', label: '' },
    { iataCode: 'HEL', name: 'Helsinki-Vantaa', cityName: 'Helsinque', countryCode: 'FI', label: '' },
    { iataCode: 'KEF', name: 'Keflavík Intl.', cityName: 'Reykjavik', countryCode: 'IS', label: '' },
    { iataCode: 'DUB', name: 'Dublin', cityName: 'Dublin', countryCode: 'IE', label: '' },
    { iataCode: 'SNN', name: 'Shannon', cityName: 'Shannon', countryCode: 'IE', label: '' },

    // ── Europa — Leste Europeu / Outros ──────────────────────────────────────
    { iataCode: 'WAW', name: 'Warsaw Chopin', cityName: 'Varsóvia', countryCode: 'PL', label: '' },
    { iataCode: 'KRK', name: 'John Paul II Intl.', cityName: 'Cracóvia', countryCode: 'PL', label: '' },
    { iataCode: 'PRG', name: 'Václav Havel', cityName: 'Praga', countryCode: 'CZ', label: '' },
    { iataCode: 'BUD', name: 'Budapest Ferenc Liszt Intl.', cityName: 'Budapeste', countryCode: 'HU', label: '' },
    { iataCode: 'OTP', name: 'Henri Coandă Intl.', cityName: 'Bucareste', countryCode: 'RO', label: '' },
    { iataCode: 'ATH', name: 'Athens Eleftherios Venizelos', cityName: 'Atenas', countryCode: 'GR', label: '' },
    { iataCode: 'SKG', name: 'Makedonia Intl.', cityName: 'Tessalônica', countryCode: 'GR', label: '' },
    { iataCode: 'HER', name: 'Nikos Kazantzakis Intl.', cityName: 'Creta / Heráklion', countryCode: 'GR', label: '' },
    { iataCode: 'RHO', name: 'Diagoras Intl.', cityName: 'Rodes', countryCode: 'GR', label: '' },
    { iataCode: 'JMK', name: 'Mykonos Intl.', cityName: 'Mykonos', countryCode: 'GR', label: '' },
    { iataCode: 'JTR', name: 'Santorini (Thira) Intl.', cityName: 'Santorini', countryCode: 'GR', label: '' },
    { iataCode: 'CFU', name: 'Ioannis Kapodistrias Intl.', cityName: 'Corfu', countryCode: 'GR', label: '' },
    { iataCode: 'SVO', name: 'Sheremetyevo Intl.', cityName: 'Moscou', countryCode: 'RU', label: '' },
    { iataCode: 'DME', name: 'Domodedovo Intl.', cityName: 'Moscou', countryCode: 'RU', label: '' },
    { iataCode: 'LED', name: 'Pulkovo Intl.', cityName: 'São Petersburgo', countryCode: 'RU', label: '' },

    // ── Turquia ───────────────────────────────────────────────────────────────
    { iataCode: 'IST', name: 'Istanbul Intl.', cityName: 'Istambul', countryCode: 'TR', label: '' },
    { iataCode: 'SAW', name: 'Sabiha Gökçen Intl.', cityName: 'Istambul', countryCode: 'TR', label: '' },
    { iataCode: 'ADB', name: 'Adnan Menderes Intl.', cityName: 'Izmir', countryCode: 'TR', label: '' },
    { iataCode: 'AYT', name: 'Antalya Intl.', cityName: 'Antalya', countryCode: 'TR', label: '' },
    { iataCode: 'DLM', name: 'Dalaman', cityName: 'Dalaman', countryCode: 'TR', label: '' },
    { iataCode: 'ESB', name: 'Esenboğa Intl.', cityName: 'Ancara', countryCode: 'TR', label: '' },

    // ── Oriente Médio ─────────────────────────────────────────────────────────
    { iataCode: 'DXB', name: 'Dubai Intl.', cityName: 'Dubai', countryCode: 'AE', label: '' },
    { iataCode: 'DWC', name: 'Al Maktoum Intl.', cityName: 'Dubai', countryCode: 'AE', label: '' },
    { iataCode: 'AUH', name: 'Abu Dhabi Intl.', cityName: 'Abu Dhabi', countryCode: 'AE', label: '' },
    { iataCode: 'SHJ', name: 'Sharjah Intl.', cityName: 'Sharjah', countryCode: 'AE', label: '' },
    { iataCode: 'DOH', name: 'Hamad Intl.', cityName: 'Doha', countryCode: 'QA', label: '' },
    { iataCode: 'RUH', name: 'King Khalid Intl.', cityName: 'Riade', countryCode: 'SA', label: '' },
    { iataCode: 'JED', name: 'King Abdulaziz Intl.', cityName: 'Jeddah', countryCode: 'SA', label: '' },
    { iataCode: 'DMM', name: 'King Fahd Intl.', cityName: 'Dammam', countryCode: 'SA', label: '' },
    { iataCode: 'KWI', name: 'Kuwait Intl.', cityName: 'Kuwait City', countryCode: 'KW', label: '' },
    { iataCode: 'BAH', name: 'Bahrain Intl.', cityName: 'Manama', countryCode: 'BH', label: '' },
    { iataCode: 'AMM', name: 'Queen Alia Intl.', cityName: 'Amã', countryCode: 'JO', label: '' },
    { iataCode: 'BEY', name: 'Rafic Hariri Intl.', cityName: 'Beirute', countryCode: 'LB', label: '' },
    { iataCode: 'TLV', name: 'Ben Gurion Intl.', cityName: 'Tel Aviv', countryCode: 'IL', label: '' },
    { iataCode: 'CAI', name: 'Cairo Intl.', cityName: 'Cairo', countryCode: 'EG', label: '' },
    { iataCode: 'HRG', name: 'Hurghada Intl.', cityName: 'Hurghada', countryCode: 'EG', label: '' },

    // ── África ────────────────────────────────────────────────────────────────
    { iataCode: 'JNB', name: 'O.R. Tambo Intl.', cityName: 'Johannesburgo', countryCode: 'ZA', label: '' },
    { iataCode: 'CPT', name: 'Cape Town Intl.', cityName: 'Cidade do Cabo', countryCode: 'ZA', label: '' },
    { iataCode: 'DUR', name: 'King Shaka Intl.', cityName: 'Durban', countryCode: 'ZA', label: '' },
    { iataCode: 'NBO', name: 'Jomo Kenyatta Intl.', cityName: 'Nairóbi', countryCode: 'KE', label: '' },
    { iataCode: 'ADD', name: 'Bole Intl.', cityName: 'Adis Abeba', countryCode: 'ET', label: '' },
    { iataCode: 'CMN', name: 'Mohammed V Intl.', cityName: 'Casablanca', countryCode: 'MA', label: '' },
    { iataCode: 'RAK', name: 'Marrakesh Menara', cityName: 'Marrakech', countryCode: 'MA', label: '' },
    { iataCode: 'LOS', name: 'Murtala Muhammed Intl.', cityName: 'Lagos', countryCode: 'NG', label: '' },
    { iataCode: 'ACC', name: 'Kotoka Intl.', cityName: 'Acra', countryCode: 'GH', label: '' },
    { iataCode: 'DKR', name: 'Blaise Diagne Intl.', cityName: 'Dacar', countryCode: 'SN', label: '' },
    { iataCode: 'LAD', name: 'Quatro de Fevereiro Intl.', cityName: 'Luanda', countryCode: 'AO', label: '' },
    { iataCode: 'TUN', name: 'Tunis-Carthage Intl.', cityName: 'Tunis', countryCode: 'TN', label: '' },
    { iataCode: 'ALG', name: 'Houari Boumediene Intl.', cityName: 'Argel', countryCode: 'DZ', label: '' },

    // ── Ásia — Japão / Coreia ─────────────────────────────────────────────────
    { iataCode: 'NRT', name: 'Narita Intl.', cityName: 'Tóquio', countryCode: 'JP', label: '' },
    { iataCode: 'HND', name: 'Tokyo Haneda', cityName: 'Tóquio', countryCode: 'JP', label: '' },
    { iataCode: 'KIX', name: 'Kansai Intl.', cityName: 'Osaka', countryCode: 'JP', label: '' },
    { iataCode: 'NGO', name: 'Chubu Centrair Intl.', cityName: 'Nagoya', countryCode: 'JP', label: '' },
    { iataCode: 'CTS', name: 'New Chitose', cityName: 'Sapporo', countryCode: 'JP', label: '' },
    { iataCode: 'FUK', name: 'Fukuoka', cityName: 'Fukuoka', countryCode: 'JP', label: '' },
    { iataCode: 'ICN', name: 'Incheon Intl.', cityName: 'Seul', countryCode: 'KR', label: '' },
    { iataCode: 'GMP', name: 'Gimpo Intl.', cityName: 'Seul', countryCode: 'KR', label: '' },
    { iataCode: 'PUS', name: 'Gimhae Intl.', cityName: 'Busan', countryCode: 'KR', label: '' },

    // ── Ásia — China / HK / Taiwan ────────────────────────────────────────────
    { iataCode: 'PEK', name: 'Beijing Capital Intl.', cityName: 'Pequim', countryCode: 'CN', label: '' },
    { iataCode: 'PKX', name: 'Beijing Daxing Intl.', cityName: 'Pequim', countryCode: 'CN', label: '' },
    { iataCode: 'PVG', name: 'Shanghai Pudong Intl.', cityName: 'Xangai', countryCode: 'CN', label: '' },
    { iataCode: 'SHA', name: 'Shanghai Hongqiao Intl.', cityName: 'Xangai', countryCode: 'CN', label: '' },
    { iataCode: 'CAN', name: 'Guangzhou Baiyun Intl.', cityName: 'Guangzhou', countryCode: 'CN', label: '' },
    { iataCode: 'SZX', name: 'Shenzhen Bao\'an Intl.', cityName: 'Shenzhen', countryCode: 'CN', label: '' },
    { iataCode: 'CTU', name: 'Chengdu Tianfu Intl.', cityName: 'Chengdu', countryCode: 'CN', label: '' },
    { iataCode: 'KMG', name: 'Changshui Intl.', cityName: 'Kunming', countryCode: 'CN', label: '' },
    { iataCode: 'HKG', name: 'Hong Kong Intl.', cityName: 'Hong Kong', countryCode: 'HK', label: '' },
    { iataCode: 'TPE', name: 'Taiwan Taoyuan Intl.', cityName: 'Taipei', countryCode: 'TW', label: '' },

    // ── Ásia — Sudeste Asiático ───────────────────────────────────────────────
    { iataCode: 'SIN', name: 'Singapore Changi', cityName: 'Cingapura', countryCode: 'SG', label: '' },
    { iataCode: 'BKK', name: 'Suvarnabhumi Intl.', cityName: 'Bangkok', countryCode: 'TH', label: '' },
    { iataCode: 'DMK', name: 'Don Mueang Intl.', cityName: 'Bangkok', countryCode: 'TH', label: '' },
    { iataCode: 'HKT', name: 'Phuket Intl.', cityName: 'Phuket', countryCode: 'TH', label: '' },
    { iataCode: 'CNX', name: 'Chiang Mai Intl.', cityName: 'Chiang Mai', countryCode: 'TH', label: '' },
    { iataCode: 'KUL', name: 'Kuala Lumpur Intl.', cityName: 'Kuala Lumpur', countryCode: 'MY', label: '' },
    { iataCode: 'CGK', name: 'Soekarno-Hatta Intl.', cityName: 'Jacarta', countryCode: 'ID', label: '' },
    { iataCode: 'DPS', name: 'Ngurah Rai Intl. (Bali)', cityName: 'Bali', countryCode: 'ID', label: '' },
    { iataCode: 'SUB', name: 'Juanda Intl.', cityName: 'Surabaya', countryCode: 'ID', label: '' },
    { iataCode: 'MNL', name: 'Ninoy Aquino Intl.', cityName: 'Manila', countryCode: 'PH', label: '' },
    { iataCode: 'CEB', name: 'Mactan-Cebu Intl.', cityName: 'Cebu', countryCode: 'PH', label: '' },
    { iataCode: 'HAN', name: 'Noi Bai Intl.', cityName: 'Hanói', countryCode: 'VN', label: '' },
    { iataCode: 'SGN', name: 'Tan Son Nhat Intl.', cityName: 'Ho Chi Minh City', countryCode: 'VN', label: '' },
    { iataCode: 'DAD', name: 'Da Nang Intl.', cityName: 'Da Nang', countryCode: 'VN', label: '' },
    { iataCode: 'PNH', name: 'Phnom Penh Intl.', cityName: 'Phnom Penh', countryCode: 'KH', label: '' },
    { iataCode: 'REP', name: 'Siem Reap-Angkor Intl.', cityName: 'Siem Reap', countryCode: 'KH', label: '' },
    { iataCode: 'RGN', name: 'Yangon Intl.', cityName: 'Yangon', countryCode: 'MM', label: '' },

    // ── Ásia — Índia ─────────────────────────────────────────────────────────
    { iataCode: 'DEL', name: 'Indira Gandhi Intl.', cityName: 'Nova Delhi', countryCode: 'IN', label: '' },
    { iataCode: 'BOM', name: 'Chhatrapati Shivaji Maharaj Intl.', cityName: 'Mumbai', countryCode: 'IN', label: '' },
    { iataCode: 'BLR', name: 'Kempegowda Intl.', cityName: 'Bangalore', countryCode: 'IN', label: '' },
    { iataCode: 'MAA', name: 'Chennai Intl.', cityName: 'Chennai', countryCode: 'IN', label: '' },
    { iataCode: 'HYD', name: 'Rajiv Gandhi Intl.', cityName: 'Hyderabad', countryCode: 'IN', label: '' },
    { iataCode: 'CCU', name: 'Netaji Subhas Chandra Bose Intl.', cityName: 'Calcutá', countryCode: 'IN', label: '' },
    { iataCode: 'GOI', name: 'Goa Intl.', cityName: 'Goa', countryCode: 'IN', label: '' },

    // ── Oceania ───────────────────────────────────────────────────────────────
    { iataCode: 'SYD', name: 'Kingsford Smith Intl.', cityName: 'Sydney', countryCode: 'AU', label: '' },
    { iataCode: 'MEL', name: 'Melbourne Tullamarine', cityName: 'Melbourne', countryCode: 'AU', label: '' },
    { iataCode: 'BNE', name: 'Brisbane Intl.', cityName: 'Brisbane', countryCode: 'AU', label: '' },
    { iataCode: 'PER', name: 'Perth Intl.', cityName: 'Perth', countryCode: 'AU', label: '' },
    { iataCode: 'ADL', name: 'Adelaide Intl.', cityName: 'Adelaide', countryCode: 'AU', label: '' },
    { iataCode: 'OOL', name: 'Gold Coast', cityName: 'Gold Coast', countryCode: 'AU', label: '' },
    { iataCode: 'CNS', name: 'Cairns', cityName: 'Cairns', countryCode: 'AU', label: '' },
    { iataCode: 'AKL', name: 'Auckland Intl.', cityName: 'Auckland', countryCode: 'NZ', label: '' },
    { iataCode: 'CHC', name: 'Christchurch Intl.', cityName: 'Christchurch', countryCode: 'NZ', label: '' },
    { iataCode: 'WLG', name: 'Wellington Intl.', cityName: 'Wellington', countryCode: 'NZ', label: '' },
    { iataCode: 'NAN', name: 'Nadi Intl.', cityName: 'Nadi', countryCode: 'FJ', label: '' },
    { iataCode: 'PPT', name: 'Faa\'a Intl.', cityName: 'Papeete', countryCode: 'PF', label: '' },

    // ── Caribe ────────────────────────────────────────────────────────────────
    { iataCode: 'HAV', name: 'José Martí Intl.', cityName: 'Havana', countryCode: 'CU', label: '' },
    { iataCode: 'PUJ', name: 'Punta Cana Intl.', cityName: 'Punta Cana', countryCode: 'DO', label: '' },
    { iataCode: 'SDQ', name: 'Las Américas Intl.', cityName: 'Santo Domingo', countryCode: 'DO', label: '' },
    { iataCode: 'SJU', name: 'Luis Muñoz Marín Intl.', cityName: 'San Juan', countryCode: 'PR', label: '' },
    { iataCode: 'KIN', name: 'Norman Manley Intl.', cityName: 'Kingston', countryCode: 'JM', label: '' },
    { iataCode: 'MBJ', name: 'Sangster Intl.', cityName: 'Montego Bay', countryCode: 'JM', label: '' },
    { iataCode: 'NAS', name: 'Lynden Pindling Intl.', cityName: 'Nassau', countryCode: 'BS', label: '' },
    { iataCode: 'BGI', name: 'Grantley Adams Intl.', cityName: 'Barbados', countryCode: 'BB', label: '' },
    { iataCode: 'POS', name: 'Piarco Intl.', cityName: 'Port of Spain', countryCode: 'TT', label: '' },
    { iataCode: 'AUA', name: 'Queen Beatrix Intl.', cityName: 'Aruba', countryCode: 'AW', label: '' },
    { iataCode: 'CUR', name: 'Hato Intl.', cityName: 'Curaçao', countryCode: 'CW', label: '' },
    { iataCode: 'SXM', name: 'Princess Juliana Intl.', cityName: 'Sint Maarten', countryCode: 'SX', label: '' },

    // ── América Central ───────────────────────────────────────────────────────
    { iataCode: 'PTY', name: 'Tocumen Intl.', cityName: 'Panamá', countryCode: 'PA', label: '' },
    { iataCode: 'SJO', name: 'Juan Santamaría Intl.', cityName: 'San José', countryCode: 'CR', label: '' },
    { iataCode: 'GUA', name: 'La Aurora Intl.', cityName: 'Cidade da Guatemala', countryCode: 'GT', label: '' },
    { iataCode: 'SAP', name: 'Ramón Villeda Morales Intl.', cityName: 'San Pedro Sula', countryCode: 'HN', label: '' },
    { iataCode: 'SAL', name: 'El Salvador Intl.', cityName: 'San Salvador', countryCode: 'SV', label: '' },
    { iataCode: 'MGA', name: 'Augusto C. Sandino Intl.', cityName: 'Manágua', countryCode: 'NI', label: '' },

    // ── Cabo Verde / Ilhas Atlântico ──────────────────────────────────────────
    { iataCode: 'RAI', name: 'Nelson Mandela Intl.', cityName: 'Praia', countryCode: 'CV', label: '' },
    { iataCode: 'SID', name: 'Amílcar Cabral Intl.', cityName: 'Sal', countryCode: 'CV', label: '' },
]

// Normaliza texto removendo acentos para busca case-insensitive
function normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function searchAirportsLocal(query: string): Airport[] {
    const q = normalize(query.trim())
    if (q.length < 2) return []

    const scored: Array<{ airport: Airport; score: number }> = []

    for (const a of AIRPORTS) {
        const code = normalize(a.iataCode)
        const city = normalize(a.cityName)
        const name = normalize(a.name)
        const country = normalize(a.countryCode)

        let score = 0
        // Exact IATA code match → highest priority
        if (code === q) { score = 100 }
        else if (code.startsWith(q)) { score = 80 }
        // City starts with query → high priority
        else if (city.startsWith(q)) { score = 70 }
        else if (city.includes(q)) { score = 50 }
        // Airport name contains query
        else if (name.includes(q)) { score = 30 }
        // Country code (e.g. "br")
        else if (q.length === 2 && country === q) { score = 10 }
        else { continue }

        // Boost Brazilian airports for local relevance
        if (a.countryCode === 'BR') score += 5

        scored.push({ airport: a, score })
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 7)
        .map(s => ({
            ...s.airport,
            label: `${s.airport.cityName} (${s.airport.iataCode}) — ${s.airport.countryCode}`,
        }))
}
